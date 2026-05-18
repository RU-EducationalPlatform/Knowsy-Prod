// Mounts the ColorBlindTest widget inside the Knowsy-branded calibration page,
// then forwards to either the requested widget (?next=<id>) or back to /app.html
// once the user clicks "I'm done — continue."

import './observability.js';
import { requireAuth, signOut } from './auth.js';
import { setUser, breadcrumb, captureError } from './observability.js';
import { mountNavbar } from './Navbar.js';
import { WIDGETS } from './registry.js';

const CALIBRATION_KEY = 'knowsy.colorBlind.completed';
const CALIBRATED_AT_KEY = 'knowsy.colorBlind.completedAt';

const root = document.documentElement;
root.classList.add('app-auth-pending');
const user = await requireAuth();
setUser(user);
breadcrumb('calibrate_loaded', { uid: user?.uid ?? null });
root.classList.remove('app-auth-pending');

// Persistent in-app navbar — same chrome on every authenticated page.
await mountNavbar({
  user,
  currentModule: { id: 'colorblind-test', label: 'Color vision check' },
  onSignOut: () => signOut(),
});

// Mount the existing ColorBlindTest widget. The path is relative to the
// project root the same way other widgets are loaded; the dynamic import
// keeps the entire 200KB+ widget out of the catalog bundle.
try {
  const mod = await import('../modules/screening-tests/ColorBlindTest.js');
  if (typeof mod.ColorBlindTest === 'function') {
    new mod.ColorBlindTest('colorblind-test-mount');
  } else {
    throw new Error('ColorBlindTest export missing');
  }
} catch (err) {
  console.error(err);
  captureError(err, { source: 'calibrate' });
  const mount = document.getElementById('colorblind-test-mount');
  if (mount) {
    mount.innerHTML =
      '<p class="auth-status" data-kind="error">The calibration test could not be loaded. You can skip this and continue — we\'ll prompt again next time.</p>';
  }
}

// ---------- Continue / skip wiring ----------
function readNextParam() {
  const raw = new URLSearchParams(window.location.search).get('next') ?? '';
  // Only allow widget-id-shaped values to avoid open redirect.
  return /^[a-z0-9-]+$/i.test(raw) ? raw : '';
}

function navigateOnward(reason) {
  const next = readNextParam();
  breadcrumb('calibrate_finished', { reason, next });
  if (!next) {
    window.location.href = './app.html';
    return;
  }
  // Honor the registry's `page` field for widgets that have their own
  // dedicated lesson URL (e.g. bitinterp -> /bit-interpreter.html).
  // Fall back to the legacy launcher's deep-link for everything else.
  const entry = WIDGETS.find((w) => w.id === next);
  window.location.href = entry?.page
    ? entry.page
    : `./DynamicContent.html#/c/${encodeURIComponent(next)}`;
}

document.getElementById('continue-btn')?.addEventListener('click', () => {
  localStorage.setItem(CALIBRATION_KEY, 'true');
  localStorage.setItem(CALIBRATED_AT_KEY, new Date().toISOString());
  navigateOnward('completed');
});

document.getElementById('skip-btn')?.addEventListener('click', () => {
  // Don't mark calibrated — the gate will prompt again next time.
  navigateOnward('skipped');
});
