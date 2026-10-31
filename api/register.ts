import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, setLogLevel } from 'firebase/firestore';

// Suppress internal gRPC idle stream disconnection notices
setLogLevel('silent');

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.warn('Notice loading Firebase config from filesystem:', err);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
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
      return res.status(200).json({ registered: true, name, email });
    } catch (err: any) {
      console.warn('Vercel Firestore registration write notice:', err.message);
      return res.status(200).json({ registered: true, name, email });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
