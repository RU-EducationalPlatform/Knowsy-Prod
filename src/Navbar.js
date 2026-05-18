// Persistent in-app navbar. Used on every authenticated page.
//
//   import { mountNavbar } from './Navbar.js';
//   mountNavbar({
//     user: firebaseUser,           // for avatar initials + email + sign-out
//     currentModule: { id, label }, // null on the catalog; the active widget on a runner page
//     onSignOut: () => signOut(),
//   });
//
// The component reads WIDGETS from the registry to populate the module picker
// and navigates to the legacy launcher (DynamicContent.html#/c/<id>) on pick.
// Stats and settings persist to localStorage so they survive reloads.

import { signOut as fbSignOut } from './auth.js';
import { WIDGETS } from './registry.js';
import { getUserRole, visibleForRole } from './role.js';

const STATS_KEY = 'knowsy.knav.stats';
const SETTINGS_KEY = 'knowsy.knav.settings';
// Legacy launcher reads/writes 'textbook-theme' too; we mirror to keep both
// surfaces in sync without a second source of truth.
const LEGACY_THEME_KEY = 'textbook-theme';
const DEFAULT_STATS = { xp: 0, level: 1, streak: 0 };
const DEFAULT_SETTINGS = { sound: true, reduceMotion: false, darkMode: false };
const xpForLevel = (lvl) => 200 + lvl * 100;

// Help-doc filename overrides (matches the launcher's HELP_DOC_FILES).
const HELP_DOC_OVERRIDES = { x86: 'X86Assembler.md' };

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/** Single first letter of the username, matching the profile page's monogram.
 *  The avatar circle in the navbar mirrors the profile tile's behaviour:
 *  doodle (if drawn) > photo (if uploaded) > first letter > fallback. */
function firstLetterFor(user) {
  const name = (user?.displayName || '').trim();
  const email = (user?.email || '').trim();
  if (name) return name[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return user ? '·' : '?';
}

/** Read the user's saved avatar art (drawing wins over photo). */
function getAvatarArt() {
  try {
    const doodle = localStorage.getItem('knowsy.doodle');
    if (doodle) return { kind: 'doodle', src: doodle };
    const photo = localStorage.getItem('knowsy.photo');
    if (photo) return { kind: 'photo', src: photo };
  } catch { /* ignore */ }
  return null;
}

/** Build the .who block for the avatar popover with graceful fallbacks for
 *  missing displayName / email. Returns the inner HTML for `<div class="who">`. */
function renderUserWho(user) {
  if (!user) {
    return `<span class="name">Knowsy guest</span><span class="email">not signed in</span>`;
  }
  const dn = (user.displayName || '').trim();
  const em = (user.email || '').trim();
  if (dn && em) return `<span class="name">${escapeHtml(dn)}</span><span class="email">${escapeHtml(em)}</span>`;
  if (em) return `<span class="name">${escapeHtml(em.split('@')[0])}</span><span class="email">${escapeHtml(em)}</span>`;
  if (dn) return `<span class="name">${escapeHtml(dn)}</span>`;
  return `<span class="name">Knowsy member</span><span class="email">signed in</span>`;
}

/** Italicize the last word of a label (e.g. "Bits as Numbers" → "Bits as <em>Numbers</em>"). */
function emphasizeLast(text) {
  return escapeHtml(text).replace(/(\S+)\s*$/, '<em>$1</em>');
}

/** Render the static navbar markup. */
function renderShell({ user, currentModule, modules }) {
  const firstLetter = escapeHtml(firstLetterFor(user));
  const whoHtml = renderUserWho(user);

  const moduleNum = currentModule ? String(modules.findIndex((m) => m.id === currentModule.id) + 1).padStart(2, '0') : '00';
  const moduleTitle = currentModule ? emphasizeLast(currentModule.label) : 'Pick a <em>module</em>';
  const crumbHidden = currentModule ? '' : 'data-empty';

  const moduleListHtml = modules
    .map((m, i) => {
      const num = String(i + 1).padStart(2, '0');
      const active = currentModule && currentModule.id === m.id ? ' class="active"' : '';
      const meta = currentModule && currentModule.id === m.id ? 'In progress' : 'Open';
      return `<li${active} data-module-id="${escapeHtml(m.id)}">
        <span class="num">${num}</span>
        <span><span class="name">${emphasizeLast(m.label)}</span></span>
        <span class="meta">${meta}</span>
      </li>`;
    })
    .join('');

  return `
<header class="knav" id="knav">
  <div class="knav-left">
    <button class="knav-menu" type="button" data-knav="menu" aria-label="Open menu">
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>

    <a class="knav-brand" href="./app.html" aria-label="Knowsy home">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name">Knowsy</span>
    </a>

    <div class="knav-crumbs">
      <button class="knav-module-btn" type="button" data-knav="modules" aria-haspopup="true" ${crumbHidden}>
        <span class="crumb-eyebrow"><span class="num">No.&nbsp;<span data-knav-num>${moduleNum}</span></span></span>
        <span class="crumb-title" data-knav-title>${moduleTitle}</span>
      </button>

      <div class="knav-module-pop" role="listbox" aria-label="Modules">
        <div class="pop-head"><span><b>Modules</b> · ${escapeHtml(modules.length === 1 ? 'one available' : 'all categories')}</span><span>${modules.length} total</span></div>
        <ul data-knav-module-list>${moduleListHtml}</ul>
      </div>
    </div>
  </div>

  <div></div>

  <div class="knav-right">
    <div class="knav-stats" role="group" aria-label="Progress">
      <button class="knav-stat is-streak cold" type="button" data-knav="streak" title="Day streak">
        <span class="label">Streak</span>
        <span class="val"><span data-knav-streak>0</span>d</span>
      </button>
      <button class="knav-stat is-level" type="button" title="Level">
        <span class="label">Level</span>
        <span class="val" data-knav-level>01</span>
      </button>
      <button class="knav-stat is-rank" type="button" title="Cohort rank">
        <span class="label">Rank</span>
        <span class="val" data-knav-rank>—</span>
      </button>
      <button class="knav-stat is-xp" type="button" data-knav="xp" title="XP toward next level">
        <div class="row">
          <span class="label">XP <b data-knav-xp>0</b></span>
          <span class="label"><span class="next">next <span data-knav-xp-next>300</span></span></span>
        </div>
        <div class="bar"><i data-knav-xp-bar style="width:0%"></i></div>
      </button>
    </div>

    <button class="knav-icon is-gear" type="button" data-knav="gear" aria-label="Settings">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/>
      </svg>
      <div class="knav-pop" role="menu">
        <div class="pop-head">Settings</div>
        <ul>
          <li class="toggle" data-knav-toggle="sound"><span>Sound</span><span class="switch"></span></li>
          <li class="toggle" data-knav-toggle="reduceMotion"><span>Reduce motion</span><span class="switch"></span></li>
          <li class="toggle" data-knav-toggle="darkMode"><span>Dark mode</span><span class="switch"></span></li>
        </ul>
        <div class="pop-head" style="margin-top:6px;">Help</div>
        <ul>
          <li data-knav-doc="instructions" data-knav-needs-module>Instructions</li>
          <li data-knav-doc="help" data-knav-needs-module>Help</li>
          <li data-knav-doc="about">About Knowsy</li>
        </ul>
      </div>
    </button>

    <button class="knav-avatar" type="button" data-knav="avatar" aria-label="Account">
      <span class="knav-avatar-letter" data-knav-avatar-letter>${firstLetter}</span>
      <img class="knav-avatar-img" data-knav-avatar-img alt="" hidden />
      <div class="knav-pop" role="menu">
        <div class="who">${whoHtml}</div>
        <ul>
          <li data-knav-action="profile">My profile</li>
          <li data-knav-action="achievements">Achievements</li>
          <li class="danger" data-knav-action="signout">Sign out</li>
        </ul>
      </div>
    </button>
  </div>
</header>

<aside class="knav-drawer-scrim" data-knav="scrim"></aside>
<aside class="knav-drawer" data-knav-drawer>
  <!-- Module-specific section. Populated dynamically by setModuleMenu();
       hidden when empty so the main drawer items still show first when no
       module is active. -->
  <div class="knav-drawer-module" data-knav-module-menu hidden>
    <div class="drawer-eyebrow" data-knav-module-menu-title>This module</div>
    <div class="knav-drawer-module-items" data-knav-module-menu-items></div>
  </div>

  <div class="drawer-eyebrow">Browse</div>
  <a href="./app.html"><span>Catalog</span><span class="arrow">→</span></a>
  <a href="#" data-knav-action="open-modules"><span>Modules</span><span class="arrow">→</span></a>
  <a href="./calibrate.html"><span>Color check</span><span class="arrow">→</span></a>

  <div class="drawer-eyebrow">Account</div>
  <a href="#" data-knav-action="profile"><span>Profile</span><span class="arrow">→</span></a>
  <a href="#" data-knav-action="signout"><span>Sign out</span><span class="arrow">→</span></a>
</aside>

<div class="knav-flash" data-knav-flash><span class="dot"></span><span data-knav-flash-text>Welcome</span></div>

<div class="knav-doc-dialog" data-knav-doc-dialog hidden>
  <div class="knav-doc-scrim" data-knav-doc-scrim></div>
  <div class="knav-doc-card" role="dialog" aria-modal="true">
    <div class="knav-doc-head">
      <h2 class="knav-doc-title" data-knav-doc-title></h2>
      <button class="knav-doc-close" type="button" data-knav-doc-close aria-label="Close">×</button>
    </div>
    <div class="knav-doc-body" data-knav-doc-body></div>
  </div>
</div>
  `;
}

/** Lazy-load marked + DOMPurify when the user first opens a doc. They're
 *  in /vendor/, so a single <script src=...> on demand keeps the catalog
 *  bundle small while still rendering proper markdown when needed. */
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-knav-vendor="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.dataset.knavVendor = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function loadMarkdownDeps() {
  if (window.marked && window.DOMPurify) return;
  await Promise.all([
    window.marked    ? Promise.resolve() : loadScriptOnce('/vendor/marked-14.1.2.min.js'),
    window.DOMPurify ? Promise.resolve() : loadScriptOnce('/vendor/dompurify-3.1.6.min.js'),
  ]);
}

/** Mount the navbar at the top of `target` (defaults to <body>). Returns a
 *  small controller with `setCurrentModule()`, `setUser()`, `destroy()`. */
export async function mountNavbar(opts = {}) {
  const target = opts.target ?? document.body;
  const onSignOut = opts.onSignOut ?? (() => fbSignOut());

  // Filter the module picker by the user's role (teachers see Author /
  // Progress; students don't). Falls back to 'guest' if not signed in.
  const role = await getUserRole(opts.user).catch(() => 'student');
  const modules = visibleForRole(WIDGETS, role).map((w) => ({
    id: w.id,
    label: w.label,
    category: w.category,
  }));

  const wrapper = document.createElement('div');
  wrapper.className = 'knav-host';
  wrapper.innerHTML = renderShell({
    user: opts.user,
    currentModule: opts.currentModule ?? null,
    modules,
  });
  // Insert at the very top of target.
  target.insertBefore(wrapper, target.firstChild);

  const knav = wrapper.querySelector('#knav');
  const flashEl = wrapper.querySelector('[data-knav-flash]');
  const flashText = wrapper.querySelector('[data-knav-flash-text]');

  // ---------- popover orchestration ----------
  function closeAllExcept(except) {
    if (except !== 'menu') knav.classList.remove('menu-open');
    if (except !== 'modules') knav.classList.remove('modules-open');
    if (except !== 'gear') wrapper.querySelector('[data-knav="gear"]')?.classList.remove('open');
    if (except !== 'avatar') wrapper.querySelector('[data-knav="avatar"]')?.classList.remove('open');
  }

  function flash(message) {
    if (!flashEl || !flashText) return;
    flashText.textContent = message;
    flashEl.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => flashEl.classList.remove('show'), 1600);
  }

  // ---------- avatar art (doodle / photo / first letter) ----------
  const avatarBtn   = wrapper.querySelector('[data-knav="avatar"]');
  const avatarImg   = wrapper.querySelector('[data-knav-avatar-img]');
  const avatarChar  = wrapper.querySelector('[data-knav-avatar-letter]');
  function refreshAvatarArt() {
    const art = getAvatarArt();
    if (art && avatarImg) {
      avatarImg.src = art.src;
      avatarImg.hidden = false;
      avatarBtn.classList.add('has-art');
      if (avatarChar) avatarChar.hidden = true;
    } else if (avatarImg) {
      avatarImg.hidden = true;
      avatarImg.removeAttribute('src');
      avatarBtn.classList.remove('has-art');
      if (avatarChar) avatarChar.hidden = false;
    }
  }
  refreshAvatarArt();
  // Profile page broadcasts after every doodle/photo change. Cross-tab
  // changes go through the native `storage` event.
  function onAvatarUpdate() { refreshAvatarArt(); }
  function onStorage(e) {
    if (e.key === 'knowsy.doodle' || e.key === 'knowsy.photo' || e.key === null) refreshAvatarArt();
  }
  window.addEventListener('knowsy:avatar-updated', onAvatarUpdate);
  window.addEventListener('storage', onStorage);

  // ---------- stats ----------
  let stats = readStored(STATS_KEY, DEFAULT_STATS);
  function renderStats() {
    const need = xpForLevel(stats.level);
    const pct = Math.max(0, Math.min(100, (stats.xp / need) * 100));
    wrapper.querySelector('[data-knav-xp]').textContent = stats.xp;
    wrapper.querySelector('[data-knav-xp-next]').textContent = need;
    wrapper.querySelector('[data-knav-xp-bar]').style.width = `${pct}%`;
    wrapper.querySelector('[data-knav-level]').textContent = String(stats.level).padStart(2, '0');
    wrapper.querySelector('[data-knav-streak]').textContent = stats.streak;
    wrapper.querySelector('[data-knav="streak"]').classList.toggle('cold', stats.streak === 0);
    writeStored(STATS_KEY, stats);
  }

  function addXP(amount) {
    stats.xp += amount;
    let leveled = false;
    while (stats.xp >= xpForLevel(stats.level)) {
      stats.xp -= xpForLevel(stats.level);
      stats.level += 1;
      leveled = true;
    }
    renderStats();
    flash(leveled ? `Level up — L${stats.level}` : `+${amount} XP`);
  }
  function bumpStreak() {
    stats.streak += 1;
    renderStats();
    flash(`${stats.streak}-day streak`);
  }
  renderStats();

  // ---------- settings ----------
  // Initial darkMode pulls from the legacy textbook-theme localStorage key
  // first if the user previously set it from the launcher; otherwise from
  // our own settings doc. Either way, we apply the same data-theme attribute
  // and write back to both keys.
  let settings = readStored(SETTINGS_KEY, DEFAULT_SETTINGS);
  const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    settings.darkMode = legacyTheme === 'dark';
  }

  function applyDarkMode(on) {
    const t = on ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.body.dataset.theme = t;
    localStorage.setItem(LEGACY_THEME_KEY, t);
    // The legacy launcher subscribes to this event to re-apply theme-dependent state.
    window.dispatchEvent(new CustomEvent('textbook-theme-change'));
  }

  function renderSettings() {
    for (const [key, value] of Object.entries(settings)) {
      wrapper.querySelector(`[data-knav-toggle="${key}"]`)?.classList.toggle('on', !!value);
    }
    document.documentElement.classList.toggle('knowsy-reduce-motion', !!settings.reduceMotion);
    applyDarkMode(!!settings.darkMode);
    writeStored(SETTINGS_KEY, settings);
  }
  renderSettings();

  // Track the current module so doc-menu items know what widget to load
  // help for. Updated by setCurrentModule() and reflected in the gear menu.
  let currentMod = opts.currentModule ?? null;
  function refreshDocItemVisibility() {
    wrapper.querySelectorAll('[data-knav-needs-module]').forEach((el) => {
      el.style.display = currentMod ? '' : 'none';
    });
  }
  refreshDocItemVisibility();

  // ---------- doc modal ----------
  const docDialog = wrapper.querySelector('[data-knav-doc-dialog]');
  const docTitle  = wrapper.querySelector('[data-knav-doc-title]');
  const docBody   = wrapper.querySelector('[data-knav-doc-body]');
  const docScrim  = wrapper.querySelector('[data-knav-doc-scrim]');
  const docClose  = wrapper.querySelector('[data-knav-doc-close]');

  function showDocModal(title, html) {
    if (!docDialog) return;
    docTitle.textContent = title;
    docBody.innerHTML = html;
    docDialog.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function hideDocModal() {
    if (!docDialog) return;
    docDialog.hidden = true;
    document.body.style.overflow = '';
  }
  docScrim?.addEventListener('click', hideDocModal);
  docClose?.addEventListener('click', hideDocModal);

  async function openDoc(kind) {
    let url, title;
    if (kind === 'about') {
      url = './modules/docs/instructions/about.md';
      title = 'About Knowsy';
    } else if (kind === 'instructions' && currentMod) {
      url = `./modules/docs/instructions/${currentMod.id}.md`;
      title = `Instructions — ${currentMod.label}`;
    } else if (kind === 'help' && currentMod) {
      const fname = HELP_DOC_OVERRIDES[currentMod.id] ?? `${currentMod.id}.md`;
      url = `./modules/docs/help/${fname}`;
      title = `Help — ${currentMod.label}`;
    } else {
      return;
    }
    showDocModal(title, '<p class="knav-doc-loading">Loading…</p>');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const md = await res.text();
      let html;
      try {
        await loadMarkdownDeps();
        if (window.marked && window.DOMPurify) {
          const raw = window.marked.parse(md);
          html = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
        } else {
          throw new Error('markdown deps unavailable');
        }
      } catch {
        // Plain-text fallback so users always see something.
        html = `<pre>${escapeHtml(md)}</pre>`;
      }
      // We just fetched & sanitized, so this innerHTML is safe.
      docBody.innerHTML = html;
    } catch (err) {
      docBody.innerHTML = `<p class="knav-doc-error">Could not load <code>${escapeHtml(url)}</code>: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- handlers ----------
  // Hamburger drawer
  wrapper.querySelector('[data-knav="menu"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !knav.classList.contains('menu-open');
    closeAllExcept('menu');
    knav.classList.toggle('menu-open', open);
  });
  wrapper.querySelector('[data-knav="scrim"]')?.addEventListener('click', () => {
    knav.classList.remove('menu-open');
  });

  // Module picker
  wrapper.querySelector('[data-knav="modules"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !knav.classList.contains('modules-open');
    closeAllExcept('modules');
    knav.classList.toggle('modules-open', open);
  });

  // Module list click → navigate to the widget. If the registry entry has
  // its own `page` (modern full-page lessons), go there directly; otherwise
  // fall back to the legacy launcher's deep-link.
  wrapper.querySelector('[data-knav-module-list]')?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || li.classList.contains('locked')) return;
    const id = li.dataset.moduleId;
    if (!id) return;
    knav.classList.remove('modules-open');
    if (typeof opts.onModuleSelect === 'function') {
      opts.onModuleSelect(id);
      return;
    }
    const entry = WIDGETS.find((w) => w.id === id);
    if (entry?.page) {
      window.location.href = entry.page;
    } else {
      window.location.href = `./DynamicContent.html#/c/${encodeURIComponent(id)}`;
    }
  });

  // Gear & avatar
  wrapper.querySelector('[data-knav="gear"]')?.addEventListener('click', (e) => {
    if (e.target.closest('.knav-pop')) return;
    e.stopPropagation();
    const btn = wrapper.querySelector('[data-knav="gear"]');
    const open = !btn.classList.contains('open');
    closeAllExcept('gear');
    btn.classList.toggle('open', open);
  });
  wrapper.querySelector('[data-knav="avatar"]')?.addEventListener('click', (e) => {
    if (e.target.closest('.knav-pop')) return;
    e.stopPropagation();
    const btn = wrapper.querySelector('[data-knav="avatar"]');
    const open = !btn.classList.contains('open');
    closeAllExcept('avatar');
    btn.classList.toggle('open', open);
  });

  // Settings toggles
  wrapper.querySelectorAll('[data-knav-toggle]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = el.dataset.knavToggle;
      settings[key] = !settings[key];
      renderSettings();
    });
  });

  // Avatar / drawer actions
  wrapper.addEventListener('click', (e) => {
    const action = e.target.closest('[data-knav-action]')?.dataset.knavAction;
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'signout') {
      onSignOut();
    } else if (action === 'open-modules') {
      knav.classList.remove('menu-open');
      knav.classList.add('modules-open');
    } else if (action === 'profile') {
      window.location.href = './profile.html';
    } else if (action === 'achievements') {
      // Achievements live on the profile page — jump to its anchor.
      window.location.href = './profile.html#achievements';
    }
  });

  // Doc menu (About / Instructions / Help)
  wrapper.querySelectorAll('[data-knav-doc]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllExcept(null);
      void openDoc(el.dataset.knavDoc);
    });
  });

  // Outside click + Esc (Esc also closes the doc modal if it's open)
  function onDocClick(e) {
    // Clicks inside the drawer itself (section toggles, items already
    // handled inline) must NOT bubble up to a "close everything" call.
    // Without this, hitting a section header collapsed the whole drawer
    // because the click bubbled to document.
    if (e?.target?.closest?.('.knav-drawer')) return;
    closeAllExcept(null);
  }
  function onDocKey(e) {
    if (e.key !== 'Escape') return;
    if (docDialog && !docDialog.hidden) {
      hideDocModal();
      return;
    }
    closeAllExcept(null);
  }
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);

  // ---------- module menu (dynamic) ----------
  // Each module injects its own actions into the SAME hamburger drawer so we
  // never grow a parallel toolbar. The main Browse/Account sections remain.
  //
  //   nav.setModuleMenu({
  //     title: 'Assembler',
  //     items: [
  //       // Flat items still supported …
  //       { label: 'Run', onClick: fn, shortcut: 'F5' },
  //
  //       // … but most modules should group with sections (accordion).
  //       { kind: 'section', title: 'File', items: [
  //         { label: 'New',    onClick: fn },
  //         { label: 'Open…',  onClick: fn },
  //       ]},
  //       { kind: 'section', title: 'Help', open: true, items: [
  //         { label: 'Cheat sheet', onClick: fn },
  //       ]},
  //     ],
  //   });
  //   nav.setModuleMenu(null);   // clear when the module unmounts
  const moduleMenuEl   = wrapper.querySelector('[data-knav-module-menu]');
  const moduleMenuTitle = wrapper.querySelector('[data-knav-module-menu-title]');
  const moduleMenuItems = wrapper.querySelector('[data-knav-module-menu-items]');

  function buildLeafButton(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'knav-drawer-module-item';
    if (item.danger) btn.classList.add('is-danger');
    const main = document.createElement('span');
    main.textContent = item.label ?? '';
    btn.appendChild(main);
    if (item.shortcut) {
      const sh = document.createElement('span');
      sh.className = 'knav-drawer-module-shortcut';
      sh.textContent = item.shortcut;
      btn.appendChild(sh);
    } else if (item.hint) {
      const h = document.createElement('span');
      h.className = 'knav-drawer-module-hint';
      h.textContent = item.hint;
      btn.appendChild(h);
    }
    if (item.disabled) btn.disabled = true;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      knav.classList.remove('menu-open');
      item.onClick?.(ev);
    });
    return btn;
  }

  function buildSection(item) {
    const details = document.createElement('details');
    details.className = 'knav-drawer-section';
    if (item.open) details.open = true;
    const summary = document.createElement('summary');
    summary.className = 'knav-drawer-section-title';
    const titleEl = document.createElement('span');
    titleEl.textContent = item.title ?? '';
    const caret = document.createElement('span');
    caret.className = 'knav-drawer-section-caret';
    caret.setAttribute('aria-hidden', 'true');
    summary.append(titleEl, caret);
    details.appendChild(summary);
    const list = document.createElement('div');
    list.className = 'knav-drawer-section-items';
    for (const sub of item.items ?? []) {
      if (sub.kind === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'knav-drawer-module-sep';
        list.appendChild(sep);
      } else {
        list.appendChild(buildLeafButton(sub));
      }
    }
    details.appendChild(list);
    return details;
  }

  function setModuleMenu(opts) {
    if (!moduleMenuEl) return;
    moduleMenuItems.textContent = '';
    if (!opts || !Array.isArray(opts.items) || opts.items.length === 0) {
      moduleMenuEl.hidden = true;
      return;
    }
    moduleMenuTitle.textContent = opts.title || currentMod?.label || 'This module';
    for (const item of opts.items) {
      if (item.kind === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'knav-drawer-module-sep';
        moduleMenuItems.appendChild(sep);
      } else if (item.kind === 'section') {
        moduleMenuItems.appendChild(buildSection(item));
      } else {
        moduleMenuItems.appendChild(buildLeafButton(item));
      }
    }
    moduleMenuEl.hidden = false;
  }

  const controller = {
    setCurrentModule(mod) {
      currentMod = mod ?? null;
      const numEl = wrapper.querySelector('[data-knav-num]');
      const titleEl = wrapper.querySelector('[data-knav-title]');
      const btn = wrapper.querySelector('[data-knav="modules"]');
      if (mod) {
        const idx = modules.findIndex((m) => m.id === mod.id);
        numEl.textContent = String(idx + 1).padStart(2, '0');
        titleEl.innerHTML = emphasizeLast(mod.label);
        btn.removeAttribute('data-empty');
      } else {
        numEl.textContent = '00';
        titleEl.innerHTML = 'Pick a <em>module</em>';
        btn.setAttribute('data-empty', '');
      }
      refreshDocItemVisibility();
    },
    setModuleMenu,
    addXP,
    bumpStreak,
    flash,
    destroy() {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
      window.removeEventListener('knowsy:avatar-updated', onAvatarUpdate);
      window.removeEventListener('storage', onStorage);
      if (window.knowsyNav === controller) delete window.knowsyNav;
      wrapper.remove();
    },
  };
  // Publish a single global handle so modules can attach their menu without
  // needing a reference passed in by the host page. Last navbar mounted wins
  // (there should only ever be one).
  window.knowsyNav = controller;
  return controller;
}
