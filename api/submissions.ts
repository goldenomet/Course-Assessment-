import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, setLogLevel } from 'firebase/firestore';
import { questions, calculateScore } from '../src/questions.ts';

// Suppress internal gRPC idle stream disconnection notices
setLogLevel('silent');

// Load config reliably in Vercel Serverless environment
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('Notice loading Firebase config from filesystem:', err);
}

// Initialize Firebase App for Vercel Serverless
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const adminKey = process.env.AI_COURSE_ADMIN_KEY || 'use-a-random-secret-of-at-least-32-characters';

export default async function handler(req: any, res: any) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST: Learner quiz submission
  if (req.method === 'POST') {
    const { name: rawName, email: rawEmail, answers, lessonsCompleted: rawLessons } = req.body || {};
    const name = String(rawName || '').trim();
    const email = String(rawEmail || '').trim().toLowerCase();
    const lessonsCompleted = Number(rawLessons);
    const total = questions.length;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    try {
      const docRef = doc(db, 'submissions', newRecord.id);
      await setDoc(docRef, newRecord);
      return res.status(201).json({ saved: true, score, cloudSynced: true });
    } catch (err: any) {
      console.error('Vercel Firestore write error:', err.message);
      return res.status(500).json({ error: 'Could not save submission to Cloud Firestore' });
    }
  }

  // GET: Admin retrieve submissions
  if (req.method === 'GET') {
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
      const snap = await getDocs(collection(db, 'submissions'));
      const items: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data) items.push(data);
      });
      items.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      return res.status(200).json(items);
    } catch (err: any) {
      console.error('Vercel Firestore read error:', err.message);
      return res.status(500).json({ error: 'Could not load submissions from Cloud Firestore' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
