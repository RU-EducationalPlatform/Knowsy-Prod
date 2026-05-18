// Catalog page (/app.html). Renders a grouped grid of every widget in the
// registry, with a calibration gate that prompts new users to take the
// color-vision test before opening any visual widget.

import './observability.js';
import { requireAuth, signOut } from './auth.js';
import { setUser, breadcrumb, captureError } from './observability.js';
import { WIDGETS, CATEGORIES } from './registry.js';
import { getUserRole, refreshRoleSoon, visibleForRole } from './role.js';
import { mountNavbar } from './Navbar.js';

const CALIBRATION_KEY = 'knowsy.colorBlind.completed';
const CALIBRATION_WIDGET_ID = 'colorblind-test';
const CATEGORY_BLURBS = {
  'Practice': 'Self-graded exercises and assessment tools.',
  'Bits and gates': 'Bit interpretation, Boolean algebra, K-maps, error coding.',
  'Assembler': 'Step through real ISAs in the browser. Registers, breakpoints, memory.',
  'Programming': 'See how source code becomes machine behavior.',
  'Reference': 'Quick lookups — memory layouts, command pages.',
  'Tools': 'Things that aren\'t lessons but are useful.',
  'Graphics': 'GLSL shaders, multi-pass pipelines, debuggers.',
  'Electronics': 'Diagrammatic circuit reasoning.',
  'Chemistry': 'Periodic structure, electron configurations.',
  'Materials': 'Semiconductor structure and properties.',
  'RF': 'Antennas, propagation, Smith charts.',
  'Data Structures': 'Trees and ropes you can mutate live.',
  'Mechanics': 'Static equilibrium and beam analysis.',
  'Geography': 'Map projections and the math behind them.',
  'Tests': 'Sandbox pages — and the color-vision check.',
};

// ---------- Auth gate ----------
const root = document.documentElement;
root.classList.add('app-auth-pending');
const user = await requireAuth();
setUser(user);
let role = await getUserRole(user);
breadcrumb('catalog_loaded', { uid: user?.uid ?? null, role, widgets: WIDGETS.length });
root.classList.remove('app-auth-pending');

// Persistent in-app navbar — mounts at the very top of the page.
// On the catalog there's no current module yet (the user is choosing one).
const navbar = await mountNavbar({
  user,
  currentModule: null,
  onSignOut: () => signOut(),
});

// Brand-new accounts may not have the `role` claim yet — the Cloud Function
// that assigns it runs async. Refresh the token after a short delay; if the
// role changed, re-render the catalog so newly-promoted teachers see the
// extra tools without manually reloading.
if (user) {
  refreshRoleSoon(user).then((freshRole) => {
    if (freshRole && freshRole !== role) {
      role = freshRole;
      renderCatalog();
    }
  });
}

// ---------- Hero name ----------
const userName = document.getElementById('catalog-user-name');
if (user && userName) {
  // Use first name (split on @ or space) for the hero, with a fallback flourish.
  const display = (user.displayName ?? '').split(' ')[0] || (user.email ?? '').split('@')[0];
  userName.textContent = display ? `${display}.` : 'curious one.';
}

// ---------- Render the catalog ----------
const catalogEl = document.getElementById('catalog');
const emptyEl = document.getElementById('catalog-empty');
const countEl = document.getElementById('catalog-count');

renderCatalog();

function renderCatalog() {
  if (!catalogEl) return;

  // Filter widgets the current role isn't allowed to see (e.g. teachers-only
  // tools like Author / Progress are hidden from students). Then group by
  // category, preserving CATEGORIES order, dropping empty groups.
  const visible = visibleForRole(WIDGETS, role);
  const byCategory = new Map(CATEGORIES.map((name) => [name, []]));
  for (const w of visible) {
    const bucket = byCategory.get(w.category);
    if (bucket) bucket.push(w);
  }
  for (const [, list] of byCategory) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }

  let total = 0;
  const sections = [];
  for (const [name, list] of byCategory) {
    if (list.length === 0) continue;
    total += list.length;
    sections.push(renderSection(name, list));
  }

  if (countEl) {
    countEl.textContent = `${total} interactive ${total === 1 ? 'page' : 'pages'} ready to run.`;
  }
  if (sections.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  catalogEl.innerHTML = sections.join('');

  // Wire card clicks (delegated via data-widget-id)
  catalogEl.addEventListener('click', (e) => {
    const card = e.target.closest('[data-widget-id]');
    if (!card) return;
    e.preventDefault();
    onCardClick(card.dataset.widgetId);
  });
}

function renderSection(category, widgets) {
  const blurb = CATEGORY_BLURBS[category] ?? '';
  const cards = widgets.map((w, i) => renderCard(w, i + 1)).join('');
  return `
    <section class="catalog-section">
      <div class="catalog-section-head">
        <h2 class="catalog-section-title">${escapeHtml(category).replace(/(\w+)$/, '<em>$1</em>')}</h2>
        ${blurb ? `<p class="catalog-section-blurb">${escapeHtml(blurb)}</p>` : ''}
      </div>
      <div class="catalog-grid">${cards}</div>
    </section>
  `;
}

function renderCard(w, index) {
  const num = String(index).padStart(2, '0');
  // Italicize the last word of the label for the editorial flourish.
  const labelHtml = escapeHtml(w.label).replace(/(\S+)\s*$/, '<em>$1</em>');
  return `
    <article class="catalog-card" data-widget-id="${escapeAttr(w.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(w.label)}">
      <div class="catalog-card-eyebrow">/ ${num} · ${escapeHtml(w.category)}</div>
      <h3 class="catalog-card-title">${labelHtml}</h3>
      <p class="catalog-card-desc">${escapeHtml(w.description)}</p>
      <div class="catalog-card-cta">Begin <span class="arrow">→</span></div>
    </article>
  `;
}

// ---------- Card click flow ----------
function onCardClick(widgetId) {
  const widget = WIDGETS.find((w) => w.id === widgetId);
  if (!widget) {
    captureError(new Error(`Unknown widget: ${widgetId}`), { source: 'catalog' });
    return;
  }
  breadcrumb('catalog_card_click', { id: widgetId });

  const calibrated = localStorage.getItem(CALIBRATION_KEY) === 'true';
  // The colorblind-test widget IS the calibration. Don't gate it on itself.
  if (calibrated || widgetId === CALIBRATION_WIDGET_ID) {
    navigateToWidget(widgetId);
    return;
  }
  showCalibrationGate(widgetId);
}

function navigateToWidget(widgetId) {
  const entry = WIDGETS.find((w) => w.id === widgetId);
  // Modern full-page lessons own their own URL via registry.page; only the
  // legacy widgets still go through the dynamic launcher's deep-link.
  if (entry?.page) {
    window.location.href = entry.page;
  } else {
    window.location.href = `./DynamicContent.html#/c/${encodeURIComponent(widgetId)}`;
  }
}

// ---------- Calibration gate modal ----------
const gate = document.getElementById('gate');
let pendingWidgetId = null;

function showCalibrationGate(widgetId) {
  pendingWidgetId = widgetId;
  if (gate) gate.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('gate-take')?.focus();
}

function hideCalibrationGate() {
  if (gate) gate.hidden = true;
  document.body.style.overflow = '';
  pendingWidgetId = null;
}

document.getElementById('gate-take')?.addEventListener('click', () => {
  const next = pendingWidgetId;
  hideCalibrationGate();
  // Send them through /calibrate.html, which runs the test and then forwards
  // to the original widget via ?next=<id>.
  window.location.href = `./calibrate.html?next=${encodeURIComponent(next ?? '')}`;
});

document.getElementById('gate-skip')?.addEventListener('click', () => {
  const next = pendingWidgetId;
  breadcrumb('calibration_skipped', { next });
  hideCalibrationGate();
  if (next) navigateToWidget(next);
});

// Close on Esc / backdrop click
gate?.addEventListener('click', (e) => {
  if (e.target === gate) hideCalibrationGate();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && gate && !gate.hidden) hideCalibrationGate();
});

// ---------- tiny helpers ----------
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
