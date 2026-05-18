import {
  signInWithGoogle,
  signInWithApple,
  signInWithRutgers,
  signInWithEmail,
  signUpWithEmail,
  redirectToApp,
  onAuthChange,
} from './auth.js';
import { captureError, captureMessage, setUser, breadcrumb } from './observability.js';

// ---- Mode (sign in vs sign up) ---------------------------------
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'signup' ? 'signup' : 'signin';

document.querySelectorAll('[data-mode-text]').forEach((el) => {
  el.hidden = el.dataset.modeText !== mode;
});

const eyebrow = document.getElementById('eyebrow');
if (eyebrow) eyebrow.textContent = mode === 'signup' ? '— Create an account' : '— Sign in';

const submitLabel = document.querySelector('.submit-label');
if (submitLabel) submitLabel.textContent = mode === 'signup' ? 'Create account' : 'Continue';

const modeSwitch = document.getElementById('mode-switch');
if (modeSwitch) {
  modeSwitch.textContent = mode === 'signup' ? 'Sign in instead' : 'Create an account';
  modeSwitch.href = mode === 'signup' ? './login.html' : './login.html?mode=signup';
}

// ---- Already-authenticated short-circuit ------------------------
onAuthChange((user) => {
  if (user) {
    setUser(user);
    redirectToApp();
  }
});

// ---- Password show/hide ----------------------------------------
document.querySelectorAll('[data-toggle]').forEach((t) => {
  t.addEventListener('click', () => {
    const input = t.parentElement.querySelector('input');
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    t.textContent = isPw ? 'Hide' : 'Show';
  });
});

// ---- Status helpers --------------------------------------------
const statusEl = document.getElementById('auth-status');
const submitBtn = document.querySelector('.submit');

function setStatus(msg, kind = 'info') {
  if (!statusEl) return;
  if (!msg) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    return;
  }
  statusEl.hidden = false;
  statusEl.dataset.kind = kind;
  statusEl.textContent = msg;
}

function setBusy(busy, busyText) {
  document.querySelectorAll('button, input').forEach((el) => (el.disabled = busy));
  if (submitBtn && busyText) {
    const lbl = submitBtn.querySelector('.submit-label');
    if (lbl) lbl.textContent = busy ? busyText : mode === 'signup' ? 'Create account' : 'Continue';
  }
}

function explain(err) {
  const code = err?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match. Try again or create an account.";
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address looks off.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled for this project yet.';
    case 'auth/argument-error':
      return 'Rutgers SSO is not configured yet. Ask an admin to register the SAML provider in the Firebase console.';
    default:
      return err?.message || 'Something went wrong signing you in.';
  }
}

// ---- OAuth wiring ----------------------------------------------
const providers = {
  google: signInWithGoogle,
  apple: signInWithApple,
  rutgers: signInWithRutgers,
};

document.querySelectorAll('[data-provider]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.provider;
    const fn = providers[name];
    if (!fn) return;
    setStatus(`Opening ${name[0].toUpperCase() + name.slice(1)}…`);
    setBusy(true, 'Signing in…');
    breadcrumb('oauth_start', { provider: name });
    try {
      const result = await fn();
      captureMessage('oauth_success', 'info', { provider: name });
      setUser(result?.user);
      setStatus('Signed in. Loading…', 'success');
      redirectToApp();
    } catch (err) {
      // Popup-closed-by-user is normal user behavior, not a real error.
      const code = err?.code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        captureError(err, { source: 'oauth', provider: name });
      }
      setStatus(explain(err), 'error');
      setBusy(false);
    }
  });
});

// ---- Demo users (pre-deploy) -----------------------------------
// data/demo-users.json holds fake student accounts. The form below tries
// it before calling Firebase — so signing in with one of those credentials
// works without any backend. Remove the file (and these helpers) when
// shipping a real auth flow.
let _demoUsersPromise = null;
function loadDemoUsers() {
  if (_demoUsersPromise) return _demoUsersPromise;
  _demoUsersPromise = fetch('./data/demo-users.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { users: [] }))
    .catch(() => ({ users: [] }));
  return _demoUsersPromise;
}
function tsFromOffsetDays(offsetDays) {
  const ms = Date.now() + offsetDays * 86400000;
  return Math.round(ms);
}
function expandSubmissions(rawList) {
  return (rawList || []).map((s) => ({
    ...s,
    ts: s.ts ?? tsFromOffsetDays(s.tsOffsetDays ?? 0),
  }));
}
function persistDemoLogin(record) {
  const profile = record.profile || {};
  const subs = expandSubmissions(record.submissions);
  try {
    localStorage.setItem('knowsy.demo-user', JSON.stringify(record.user || {}));
    localStorage.setItem('knowsy.profile', JSON.stringify(profile));
    // Mirror to the legacy SkillGraph key so any consumer still reading it
    // (DuolingoBar, src/main.js) sees the same thing.
    localStorage.setItem('skillgraph_profile', JSON.stringify(profile));
    localStorage.setItem('textbook:learn:submissions', JSON.stringify(subs));
    // Mirror nav-readable avatar/photo for consistency with the editorial
    // page's saveProfile() — no doodle for demo, just empty so the nav
    // falls back to the monogram.
    localStorage.removeItem('knowsy.doodle');
    if (record.user?.photoURL) localStorage.setItem('knowsy.photo', record.user.photoURL);
    else localStorage.removeItem('knowsy.photo');
  } catch { /* quota — proceed anyway */ }
}

// ---- Email form ------------------------------------------------
const form = document.getElementById('login-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = /** @type {HTMLInputElement} */ (document.getElementById('email')).value.trim();
  const password = /** @type {HTMLInputElement} */ (document.getElementById('password')).value;

  if (!email || !password) {
    setStatus('Email and password are both required.', 'error');
    return;
  }

  setBusy(true, mode === 'signup' ? 'Creating account…' : 'Signing you in…');
  setStatus('');
  breadcrumb('email_auth_start', { mode });

  // Pre-deploy demo path: if the credentials match an entry in
  // data/demo-users.json, seed the local store and route as if a real
  // Firebase sign-in succeeded.
  try {
    const { users = [] } = await loadDemoUsers();
    const match = users.find((u) =>
      String(u.email || '').toLowerCase() === email.toLowerCase() &&
      String(u.password || '') === password
    );
    if (match) {
      persistDemoLogin(match);
      setUser(match.user);
      breadcrumb('demo_user_login', { email });
      setStatus('Done. Loading your textbook…', 'success');
      window.location.href = './profile.html';
      return;
    }
  } catch (err) {
    // Demo file unreachable in this environment — fall through to Firebase.
    captureError(err, { source: 'demo_users_lookup' });
  }

  try {
    const result = mode === 'signup'
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    captureMessage('email_auth_success', 'info', { mode });
    setUser(result?.user);

    // Seed-profile bridge: if this Firebase user's email ALSO matches an
    // entry in data/demo-users.json, copy the rich profile + submissions
    // into localStorage so the user lands on a populated dashboard instead
    // of an empty one. Only seeds if the profile is currently blank (i.e.
    // first login) so we don't clobber edits made on a subsequent sign-in.
    try {
      const { users = [] } = await loadDemoUsers();
      const seed = users.find((u) =>
        String(u.email || '').toLowerCase() === email.toLowerCase()
      );
      const existing = localStorage.getItem('knowsy.profile');
      const isBlank = !existing || existing === '{}' || existing === 'null';
      if (seed && isBlank) {
        // Reuse the demo-mode persistence helper so we get profile +
        // submissions + skillgraph mirror in one shot.
        persistDemoLogin({ ...seed, user: result?.user ?? seed.user });
        breadcrumb('seeded_profile_after_signin', { email });
      }
    } catch (err) {
      // Demo file unreachable — non-fatal, the user just won't have seeded stats.
      captureError(err, { source: 'seed_profile_after_signin' });
    }

    setStatus('Done. Loading your textbook…', 'success');
    redirectToApp();
  } catch (err) {
    // Wrong-password / not-found are user errors, not engineering errors.
    const code = err?.code ?? '';
    const userError = ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email'].includes(code);
    if (!userError) captureError(err, { source: 'email_auth', mode });
    setStatus(explain(err), 'error');
    setBusy(false);
  }
});

// ---- Tiny parallax on float cards (from design) ----------------
const wrap = document.querySelector('.float-cards');
if (wrap) {
  let raf = null;
  document.addEventListener(
    'mousemove',
    (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        wrap.querySelectorAll('.fc').forEach((c, i) => {
          const k = (i + 1) * 8;
          c.style.translate = `${dx * k}px ${dy * k}px`;
        });
        raf = null;
      });
    },
    { passive: true }
  );
}
