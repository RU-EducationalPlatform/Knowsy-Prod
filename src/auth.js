// Auth helpers wrapping Firebase Auth. UI-agnostic.
import {
  GoogleAuthProvider,
  OAuthProvider,
  SAMLAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase.js';

const APP_URL = './app.html';
const LOGIN_URL = './login.html';

function ensureConfigured() {
  if (!firebaseConfigured || !auth) {
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_* in .env (see .env.example).'
    );
  }
}

export function onAuthChange(cb) {
  if (!firebaseConfigured || !auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return auth?.currentUser ?? null;
}

export async function signInWithGoogle() {
  ensureConfigured();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signInWithApple() {
  ensureConfigured();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return signInWithPopup(auth, provider);
}

// Rutgers SSO via SAML. Requires Firebase Identity Platform (paid GCP tier) and
// a SAML provider registered in the Firebase Console with the ID `saml.rutgers`,
// pointed at https://shib.rutgers.edu/idp/shibboleth (Rutgers Shibboleth IdP).
// Coordinate with Rutgers OIT to register Knowsy as a service provider before
// this will work end-to-end. Until then, this throws a clear error.
export async function signInWithRutgers() {
  ensureConfigured();
  const provider = new SAMLAuthProvider('saml.rutgers');
  return signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
  ensureConfigured();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password) {
  ensureConfigured();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  // Pre-deploy demo path. Wipe the fake-auth identity + profile blobs so the
  // next visit lands cleanly on /login.html. Removed when real auth ships.
  try {
    if (localStorage.getItem('knowsy.demo-user')) {
      localStorage.removeItem('knowsy.demo-user');
      localStorage.removeItem('knowsy.profile');
      localStorage.removeItem('skillgraph_profile');
      localStorage.removeItem('textbook:learn:submissions');
      localStorage.removeItem('knowsy.doodle');
      localStorage.removeItem('knowsy.photo');
      window.location.href = LOGIN_URL;
      return;
    }
  } catch { /* ignore */ }
  if (!firebaseConfigured || !auth) {
    window.location.href = LOGIN_URL;
    return;
  }
  await fbSignOut(auth);
  window.location.href = LOGIN_URL;
}

// Page-level helper: redirect to login if not signed in. Call once at top of
// any protected page. Returns a promise that resolves to the user (or never
// resolves if redirecting).
export function requireAuth() {
  return new Promise((resolve) => {
    // Pre-deploy demo path. /login.html writes 'knowsy.demo-user' on a
    // matching demo-credentials login (see data/demo-users.json). We resolve
    // with that synthetic identity so protected pages render without
    // touching Firebase. Removed when real auth ships.
    let demoUser = null;
    try {
      const raw = localStorage.getItem('knowsy.demo-user');
      if (raw) demoUser = JSON.parse(raw);
    } catch { /* ignore */ }
    if (demoUser && typeof demoUser === 'object') {
      resolve({ ...demoUser, isDemo: true });
      return;
    }
    if (!firebaseConfigured) {
      // Dev-mode escape hatch: with no Firebase config, skip the gate so the
      // app is still usable while you wire things up. Remove this branch once
      // you have a Firebase project provisioned.
      console.warn('[knowsy] Auth gate disabled: Firebase not configured.');
      resolve(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        window.location.replace(`${LOGIN_URL}?next=${next}`);
      }
    });
  });
}

export function redirectToApp() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  window.location.href = next ? decodeURIComponent(next) : APP_URL;
}

export const constants = { APP_URL, LOGIN_URL };
