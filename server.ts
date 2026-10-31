import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const isProd = process.env.NODE_ENV === 'production';

// Parse arguments if passed via CLI like --port 3000
const portArgIndex = process.argv.indexOf('--port');
const portArg = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
const port = Number(portArg || (isProd ? process.env.PORT || 8080 : process.env.DEFAULT_APP_PORT || 3000));
const host = '0.0.0.0';

// Default admin key matches the secret documented in README.md
const adminKey = process.env.AI_COURSE_ADMIN_KEY || 'use-a-random-secret-of-at-least-32-characters';
const dataDir = process.env.DATA_DIR || path.join(root, 'storage');
const database = path.join(dataDir, 'submissions.json');
const answerKey = [0, 0, 0, 1, 0, 1, 1, 0, 1, 1];
const rateLimits = new Map<string, { start: number; count: number }>();

fs.mkdirSync(dataDir, { recursive: true });

function readSubmissions(): any[] {
  try {
    return JSON.parse(fs.readFileSync(database, 'utf8'));
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    // Preserve records created by the earlier local version during migration.
    const oldFile = path.join(root, 'submissions.json');
    try {
      const oldRecords = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
      if (Array.isArray(oldRecords)) writeSubmissions(oldRecords);
      return Array.isArray(oldRecords) ? oldRecords : [];
    } catch (legacyError: any) {
      if (legacyError.code !== 'ENOENT') throw legacyError;
      return [];
    }
  }
}

function writeSubmissions(records: any[]) {
  const temp = `${database}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(records, null, 2), { mode: 0o600 });
  fs.renameSync(temp, database);
}

function isRateLimited(req: express.Request, bucket: string, maxRequests: number, windowMs: number): boolean {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? String(forwarded).split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const entry = rateLimits.get(key) || { start: now, count: 0 };
  if (now - entry.start > windowMs) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count += 1;
  rateLimits.set(key, entry);
  if (rateLimits.size > 5000) {
    for (const [entryKey, value] of rateLimits) {
      if (now - value.start > windowMs * 2) rateLimits.delete(entryKey);
    }
  }
  return entry.count > maxRequests;
}

const app = express();

// Security headers (tailored for AI Studio preview iframe support)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '20kb' }));

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Submit quiz answers
app.post('/api/submissions', (req, res) => {
  if (isRateLimited(req, 'student-submit', 60, 10 * 60 * 1000)) {
    res.setHeader('Retry-After', '600');
    return res.status(429).json({ error: 'Too many submissions. Try again later.' });
  }

  const { name: rawName, email: rawEmail, answers, lessonsCompleted: rawLessons } = req.body || {};
  const name = String(rawName || '').trim();
  const email = String(rawEmail || '').trim().toLowerCase();
  const lessonsCompleted = Number(rawLessons);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validAnswers =
    answers &&
    typeof answers === 'object' &&
    Array.from({ length: 10 }, (_, i) => Number.isInteger(answers[i]) && answers[i] >= 0 && answers[i] <= 2).every(Boolean) &&
    Object.keys(answers).length === 10;

  if (
    !name ||
    name.length > 120 ||
    !validEmail ||
    email.length > 254 ||
    !validAnswers ||
    !Number.isInteger(lessonsCompleted) ||
    lessonsCompleted < 0 ||
    lessonsCompleted > 3
  ) {
    return res.status(400).json({ error: 'Invalid course result' });
  }

  const score = answerKey.reduce((sum, correct, i) => sum + (answers[i] === correct ? 1 : 0), 0);
  const records = readSubmissions();
  records.push({
    id: crypto.randomUUID(),
    name,
    email,
    score,
    total: 10,
    lessonsCompleted,
    completedAt: new Date().toISOString(),
    answers: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, answers[i]])),
  });

  try {
    writeSubmissions(records);
    return res.status(201).json({ saved: true, score });
  } catch (error: any) {
    console.error('Could not save learner submission:', error.message);
    return res.status(500).json({ error: 'Could not save submission' });
  }
});

// Admin review submissions endpoint
app.get('/api/submissions', (req, res) => {
  if (isRateLimited(req, 'admin-review', 60, 60 * 1000)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }

  const headerKey = req.headers['x-admin-key'];
  const provided = Buffer.from(typeof headerKey === 'string' ? headerKey : '');
  const expected = Buffer.from(adminKey);

  const authorized =
    adminKey.length >= 32 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected);

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const records = readSubmissions().sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    return res.status(200).json(records);
  } catch (error: any) {
    console.error('Could not read learner submissions:', error.message);
    return res.status(500).json({ error: 'Could not load submissions' });
  }
});

// Text documents included with the course
app.get(['/Treat_AI_Like_a_Colleague.txt', '/Using_AI_Responsibly.txt'], (req, res) => {
  const filename = path.basename(req.path);
  const filePath = path.join(root, filename);
  if (fs.existsSync(filePath)) {
    res.type('text/plain; charset=utf-8').sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

// Admin page route
app.get(['/admin', '/admin.html'], (_req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const adminDist = path.join(root, 'dist', 'admin.html');
  const adminSrc = path.join(root, 'admin.html');

  if (isProd && fs.existsSync(adminDist)) {
    return res.sendFile(adminDist);
  }
  return res.sendFile(adminSrc);
});

async function startServer() {
  // Direct asset fallbacks
  app.use('/assets', express.static(path.join(root, 'public', 'assets')));
  app.use('/public', express.static(path.join(root, 'public')));

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(root, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`Course Assessment running at http://${host}:${port} [mode: ${isProd ? 'production' : 'development'}]`);
  });
}

startServer();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => process.exit(0));
}
