import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './src/firebase.ts';
import { questions, calculateScore } from './src/questions.ts';

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

// Candidate registration prior to answering questions
app.post('/api/register', async (req, res) => {
  const { name: rawName, email: rawEmail } = req.body || {};
  const name = String(rawName || '').trim();
  const email = String(rawEmail || '').trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || name.length < 2 || name.length > 120 || !validEmail || email.length > 254) {
    return res.status(400).json({ error: 'Please provide a valid full name and email address.' });
  }

  const regRecord = {
    id: crypto.randomUUID(),
    name,
    email,
    registeredAt: new Date().toISOString()
  };

  try {
    const docRef = doc(db, 'registrations', regRecord.id);
    await setDoc(docRef, regRecord);
  } catch (err: any) {
    // Graceful offline fallback
  }

  return res.status(200).json({ registered: true, name, email });
});

// Submit quiz answers
app.post('/api/submissions', async (req, res) => {
  if (isRateLimited(req, 'student-submit', 60, 10 * 60 * 1000)) {
    res.setHeader('Retry-After', '600');
    return res.status(429).json({ error: 'Too many submissions. Try again later.' });
  }

  const { name: rawName, email: rawEmail, answers, lessonsCompleted: rawLessons } = req.body || {};
  const name = String(rawName || '').trim();
  const email = String(rawEmail || '').trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const lessonsCompleted = Number(rawLessons);
  const total = questions.length;
  const validAnswers =
    answers &&
    typeof answers === 'object' &&
    Array.from({ length: total }, (_, i) => {
      const ans = answers[i];
      if (questions[i].multi) {
        return (
          Array.isArray(ans) &&
          ans.every(v => Number.isInteger(v) && v >= 0 && v < questions[i].a.length)
        );
      }
      return (Number.isInteger(ans) && ans >= 0 && ans < questions[i].a.length) || ans === -1;
    }).every(Boolean) &&
    Object.keys(answers).length === total;

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

  const score = calculateScore(answers);
  const newRecord = {
    id: crypto.randomUUID(),
    name,
    email,
    score,
    total,
    lessonsCompleted,
    completedAt: new Date().toISOString(),
    answers: Object.fromEntries(Array.from({ length: total }, (_, i) => [i, answers[i]])),
  };

  // 1. Cloud Firestore persistence (works on Vercel, Render, Cloud Run)
  let firestoreSaved = false;
  try {
    const docRef = doc(db, 'submissions', newRecord.id);
    await setDoc(docRef, newRecord);
    firestoreSaved = true;
  } catch (cloudErr: any) {
    console.warn('Firestore cloud write notice:', cloudErr.message);
  }

  // 2. Local disk cache (when available on non-serverless filesystems)
  try {
    const records = readSubmissions();
    records.push(newRecord);
    writeSubmissions(records);
  } catch (fsErr: any) {
    // In serverless environments like Vercel with read-only filesystems, local write is ignored
  }

  return res.status(201).json({ saved: true, score, cloudSynced: firestoreSaved });
});

// Admin review submissions endpoint
app.get('/api/submissions', async (req, res) => {
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
    // Read from Cloud Firestore first
    const itemsMap = new Map<string, any>();

    try {
      const snap = await getDocs(collection(db, 'submissions'));
      snap.forEach(d => {
        const dData = d.data();
        if (dData && dData.id) itemsMap.set(dData.id, dData);
      });
    } catch (firestoreReadErr: any) {
      console.warn('Firestore read notice:', firestoreReadErr.message);
    }

    // Merge with local records
    const localRecords = readSubmissions();
    for (const rec of localRecords) {
      if (rec && rec.id && !itemsMap.has(rec.id)) {
        itemsMap.set(rec.id, rec);
      }
    }

    const records = Array.from(itemsMap.values()).sort((a, b) => 
      (b.completedAt || '').localeCompare(a.completedAt || '')
    );

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
