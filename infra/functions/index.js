// Cloud Functions for Knowsy.
//
// Add a function here when the client cannot do the work safely:
//   - touching secrets (API keys to third-party services)
//   - mutating data the user shouldn't write directly (server-authoritative state)
//   - sending email / push notifications
//   - scheduled / batch jobs (backups, digests)
//
// Keep these small. Firebase's free tier is 125k invocations/month.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Guarded: the Functions emulator's codebase analyzer pre-initializes admin
// in some load paths, so an unconditional initializeApp() throws app/duplicate-app.
if (!getApps().length) initializeApp();

// Re-export scheduled jobs from sibling files. Firebase Functions only deploys
// what's actually exported from the entry module.
export { dailyFirestoreBackup } from './backup.js';
export { assignRoleOnCreate, refreshRoleOnAllowlistChange } from './role.js';

// Records a calibration completion. Server-stamped so the timestamp is
// authoritative — the calibrate page calls this once the color-vision
// check finishes, and the result is consulted before any module loads.
export const recordCalibration = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { mode } = req.data ?? {};
  if (!mode || typeof mode !== 'string') {
    throw new HttpsError('invalid-argument', 'mode (string) is required.');
  }
  const db = getFirestore();
  await db.doc(`users/${req.auth.uid}`).set(
    { calibration: { mode, completedAt: new Date().toISOString() } },
    { merge: true }
  );
  return { ok: true };
});
