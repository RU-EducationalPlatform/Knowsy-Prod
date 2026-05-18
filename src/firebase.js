// Firebase init. Reads config from Vite-exposed env vars (VITE_FIREBASE_*).
// In dev with no .env, we still build, but auth calls will throw with a clear message.
//
// Local-emulator mode: set VITE_USE_EMULATORS=1 alongside any valid
// VITE_FIREBASE_* config (the project doesn't have to be real — `demo-knowsy`
// works) and Auth/Firestore/Functions/Storage all wire to localhost ports
// matching firebase.json. Only active in `vite dev`; the prod build never
// includes the emulator connect calls because they're behind `import.meta.env.DEV`.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // optional but recommended:
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app = null;
let auth = null;

if (firebaseConfigured) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);

  // Emulator wiring — dev-only, opt-in via env var. Dynamic imports keep the
  // firestore/functions/storage SDKs out of the landing/login bundles when
  // not in use.
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1') {
    const [{ connectAuthEmulator }, fs, fn, st] = await Promise.all([
      import('firebase/auth'),
      import('firebase/firestore'),
      import('firebase/functions'),
      import('firebase/storage'),
    ]);
    try { connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true }); } catch { /* already connected */ }
    try { fs.connectFirestoreEmulator(fs.getFirestore(app), 'localhost', 8080); } catch { /* already connected */ }
    try { fn.connectFunctionsEmulator(fn.getFunctions(app, 'us-central1'), 'localhost', 5001); } catch { /* already connected */ }
    try { st.connectStorageEmulator(st.getStorage(app), 'localhost', 9199); } catch { /* already connected */ }
    // eslint-disable-next-line no-console
    console.info('[knowsy] connected to local Firebase emulators (auth:9099 firestore:8080 functions:5001 storage:9199)');
  }
} else if (typeof window !== 'undefined') {
  console.warn(
    '[knowsy] Firebase env vars not set. Copy .env.example → .env and fill in your project values.'
  );
}

export { app, auth };
