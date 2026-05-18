// Profile page (/profile.html). Mounts the persistent navbar at the top
// and then runs the page-local interactivity (avatar flip + doodle + photo,
// editable name + bio, mood/energy linkage, skill radar drag, 365-day
// heatmap, achievement vault, sticky-note wall, classes grid).
//
// Single source of truth: localStorage['knowsy.profile'], read and written
// exclusively through ProfileManager (src/ProfileManager.js). That same
// manager mirrors writes to the legacy 'skillgraph_profile' key so existing
// readers (util/learn/DuolingoBar.js, the SkillGraph entry in src/main.js)
// stay in sync. Editorial-only legacy keys (knowsy.doodle, knowsy.photo)
// are kept up to date by saveProfile() below for the persistent navbar.

import './observability.js';
import { requireAuth, signOut } from './auth.js';
import { setUser, breadcrumb } from './observability.js';
import { mountNavbar } from './Navbar.js';
import ProfileManager from './ProfileManager.js';
import { VISIBILITY } from './profileModel.js';

const StorageManager = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
};

const root = document.documentElement;
root.classList.add('app-auth-pending');
const user = await requireAuth();
setUser(user);
breadcrumb('profile_loaded', { uid: user?.uid ?? null });
root.classList.remove('app-auth-pending');

// Pull the canonical profile, hydrating from the Firebase auth user the
// first time we see them (Create Account / first login). We do this BEFORE
// mountNavbar so we can patch missing user fields (displayName / photoURL)
// from the profile — that keeps the avatar dropdown showing "Ada Lovelace"
// even if a stale knowsy.demo-user blob is missing the field.
let profile = ProfileManager.loadForUser(StorageManager, user);
const navUser = {
  ...(user || {}),
  displayName:
    (user?.displayName && user.displayName.trim()) ||
    (profile?.display_name && profile.display_name.trim()) ||
    (profile?.name && profile.name.trim()) ||
    profile?.preferredName ||
    '',
  email:
    (user?.email && user.email.trim()) ||
    (profile?.email?.value && profile.email.value.trim()) ||
    profile?.contact?.email ||
    '',
  photoURL:
    (user?.photoURL && user.photoURL.trim()) ||
    profile?.avatar_url ||
    profile?.photoDataUrl ||
    '',
};

await mountNavbar({
  user: navUser,
  // The profile is a meta-page about the user, not a widget — keep the
  // breadcrumb empty so the picker reads "Pick a module".
  currentModule: null,
  onSignOut: () => signOut(),
});

function saveProfile() {
  profile = ProfileManager.save(StorageManager, profile);
  // Editorial-only legacy mirrors (the persistent navbar reads these).
  try {
    if (profile.doodleDataUrl) localStorage.setItem('knowsy.doodle', profile.doodleDataUrl);
    else localStorage.removeItem('knowsy.doodle');
    if (profile.photoDataUrl) localStorage.setItem('knowsy.photo', profile.photoDataUrl);
    else localStorage.removeItem('knowsy.photo');
  } catch { /* quota */ }
}

/* ============ Profile interactions ============ */
(function () {

  // ---------- toast ----------
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  let toastT;
  function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  // ---------- editable name + bio (persist) ----------
  const nameEl = document.getElementById('userName');
  const bioEl = document.getElementById('userBio');

  // ---------- avatar monogram follows display name ----------
  const avatar = document.getElementById('avatar');
  const monoEl = document.getElementById('avMono');
  function syncMono() {
    const first = (nameEl.textContent.trim()[0] || 'A').toUpperCase();
    monoEl.innerHTML = first + '<em>.</em>';
  }
  syncMono();
  nameEl.addEventListener('input', syncMono);

  // ---------- avatar: flip ----------
  avatar.querySelectorAll('[data-act="flip"]').forEach(b =>
    b.addEventListener('click', (e) => { e.stopPropagation(); avatar.classList.toggle('is-flipped'); })
  );

  // ---------- avatar: animated tile (baroque scroll ornament) ----------
  // The brush traces out a deliberate, symmetric ornamental scroll —
  // two spiral terminals flanking a central crest, joined by sweeping
  // arches. Drawn over ~7 seconds so you actually watch it being inked.
  // Once complete it holds for a beat, fades, and redraws with a slight
  // rotation + palette variation. Pointer hover nudges the next ornament's
  // anchor toward the cursor; nothing the user does becomes content.
  const canvas = document.getElementById('avAnim');
  const ctx = canvas.getContext('2d');

  function broadcastAvatarChange() {
    window.dispatchEvent(new CustomEvent('knowsy:avatar-updated'));
  }

  const _probe = document.createElement('span');
  _probe.style.display = 'none';
  document.body.appendChild(_probe);
  function cssToRgb(color) {
    _probe.style.color = '';
    _probe.style.color = color;
    const cs = getComputedStyle(_probe).color || 'rgb(27, 33, 71)';
    const m = cs.match(/\d+/g);
    if (!m || m.length < 3) return { r: 27, g: 33, b: 71 };
    return { r: +m[0], g: +m[1], b: +m[2] };
  }

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  const animParams = {
    moodRgb:  { r: 27, g: 33, b: 71 },
    inkRgb:   { r: 27, g: 33, b: 71 },
    paperRgb: { r: 245, g: 240, b: 225 },
    acidRgb:  { r: 200, g: 16, b: 46 },
    energy: 0.7,        // 0.4-1.2, modulated by profile.energy
  };

  function refreshAnimParams() {
    const moodColor = (getComputedStyle(document.querySelector('.pf-mood'))
      .getPropertyValue('--mood-color') || '').trim() || '#1B2147';
    const inkColor = (getComputedStyle(document.documentElement)
      .getPropertyValue('--ink') || '').trim() || '#1B2147';
    const paperColor = (getComputedStyle(document.documentElement)
      .getPropertyValue('--paper') || '').trim() || '#F5F0E1';
    const acidColor = (getComputedStyle(document.documentElement)
      .getPropertyValue('--acid') || '').trim() || '#C8102E';
    animParams.moodRgb = cssToRgb(moodColor);
    animParams.inkRgb  = cssToRgb(inkColor);
    animParams.paperRgb = cssToRgb(paperColor);
    animParams.acidRgb = cssToRgb(acidColor);
    const e = Math.max(10, Math.min(100, +profile.energy || 60));
    animParams.energy = 0.55 + (e / 100) * 0.7;
  }

  let pointer = { x: -1e6, y: -1e6, active: false };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = true;
  });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });

  // Build a sequence of brush strokes that together draw a desktop-computer
  // line illustration: monitor + code on screen + power LED + stand +
  // keyboard + keys + mouse. Each stroke is an array of [x, y] points
  // sampled densely. The animator draws them in order over ~8 seconds.
  function buildComputerStrokes(cx, cy, w, h, scale = 1) {
    const sd = Math.min(w, h) * scale;
    const strokes = [];

    function linePts(p0, p1, n = 24) {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
      }
      return out;
    }
    function arcPts(cxp, cyp, rx, ry, t0, t1, n = 14) {
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const th = t0 + (t1 - t0) * t;
        out.push([cxp + rx * Math.cos(th), cyp + ry * Math.sin(th)]);
      }
      return out;
    }
    function rrectPts(x, y, ww, hh, r, edgeN = 18, cornerN = 10) {
      const out = [];
      const rad = Math.min(r, Math.min(ww, hh) / 2);
      // top edge
      out.push(...linePts([x + rad, y], [x + ww - rad, y], edgeN));
      // top-right corner
      out.push(...arcPts(x + ww - rad, y + rad, rad, rad, -Math.PI/2, 0, cornerN));
      // right edge
      out.push(...linePts([x + ww, y + rad], [x + ww, y + hh - rad], edgeN));
      // bottom-right corner
      out.push(...arcPts(x + ww - rad, y + hh - rad, rad, rad, 0, Math.PI/2, cornerN));
      // bottom edge
      out.push(...linePts([x + ww - rad, y + hh], [x + rad, y + hh], edgeN));
      // bottom-left corner
      out.push(...arcPts(x + rad, y + hh - rad, rad, rad, Math.PI/2, Math.PI, cornerN));
      // left edge
      out.push(...linePts([x, y + hh - rad], [x, y + rad], edgeN));
      // top-left corner (close)
      out.push(...arcPts(x + rad, y + rad, rad, rad, Math.PI, 3*Math.PI/2, cornerN));
      return out;
    }

    // ---- Monitor ----
    const mLeft = cx - 0.30 * sd, mRight = cx + 0.30 * sd;
    const mTop  = cy - 0.34 * sd, mBottom = cy + 0.04 * sd;
    strokes.push(rrectPts(mLeft, mTop, mRight - mLeft, mBottom - mTop, sd * 0.022, 14, 8));

    // ---- Screen inset ----
    const inset = sd * 0.020;
    const sLeft = mLeft + inset, sRight = mRight - inset;
    const sTop  = mTop + inset,  sBottom = mBottom - inset - sd * 0.016;
    strokes.push(rrectPts(sLeft, sTop, sRight - sLeft, sBottom - sTop, sd * 0.008, 12, 6));

    // ---- Code lines on screen (4 lines of varying length, slight indents) ----
    const codeLeft = sLeft + sd * 0.024;
    const codeRight = sRight - sd * 0.020;
    const codeTop = sTop + sd * 0.022;
    const codeBottom = sBottom - sd * 0.022;
    const lineH = (codeBottom - codeTop) / 4;
    const lineLen = [0.55, 0.85, 0.40, 0.70];
    const lineIndent = [0, 0.04, 0.04, 0.0];
    let cursorAnchor = null;
    for (let i = 0; i < 4; i++) {
      const y = codeTop + (i + 0.5) * lineH;
      const x0 = codeLeft + (codeRight - codeLeft) * lineIndent[i];
      const x1 = codeLeft + (codeRight - codeLeft) * lineLen[i];
      strokes.push(linePts([x0, y], [x1, y], 22));
      if (i === 3) cursorAnchor = [x1 + sd * 0.014, y];
    }

    // ---- Cursor block (vertical bar after the last code line) ----
    if (cursorAnchor) {
      strokes.push(linePts(
        [cursorAnchor[0], cursorAnchor[1] - sd * 0.012],
        [cursorAnchor[0], cursorAnchor[1] + sd * 0.012],
        8
      ));
    }

    // ---- Power LED (small filled-feeling circle bottom-right of monitor) ----
    const ledR = sd * 0.008;
    strokes.push(arcPts(mRight - sd * 0.026, mBottom - sd * 0.012, ledR, ledR, 0, Math.PI * 2, 22));

    // ---- Brand mark (tiny horizontal dash bottom-left of monitor) ----
    strokes.push(linePts(
      [mLeft + sd * 0.022, mBottom - sd * 0.012],
      [mLeft + sd * 0.060, mBottom - sd * 0.012],
      10
    ));

    // ---- Stand neck ----
    const standTop = mBottom;
    const standBase = mBottom + sd * 0.07;
    strokes.push(linePts([cx, standTop], [cx, standBase], 12));

    // ---- Stand base (full ellipse for a 3D-feeling foot) ----
    strokes.push(arcPts(cx, standBase, sd * 0.11, sd * 0.020, 0, Math.PI * 2, 36));

    // ---- Keyboard outline (wider than the monitor for proportion) ----
    const kTop = standBase + sd * 0.04;
    const kBottom = kTop + sd * 0.060;
    const kLeft = cx - 0.35 * sd, kRight = cx + 0.35 * sd;
    strokes.push(rrectPts(kLeft, kTop, kRight - kLeft, kBottom - kTop, sd * 0.010, 14, 6));

    // ---- Keyboard keys: 2 rows × 9 keys, short horizontal dashes ----
    const keyCount = 9;
    const keyMargin = sd * 0.020;
    const keyAreaLeft = kLeft + keyMargin;
    const keyAreaRight = kRight - keyMargin;
    const keyAreaTop = kTop + sd * 0.012;
    const keyAreaBottom = kBottom - sd * 0.012;
    const keyRowH = (keyAreaBottom - keyAreaTop) / 2;
    const keyGap = sd * 0.006;
    const keyW = (keyAreaRight - keyAreaLeft - (keyCount - 1) * keyGap) / keyCount;
    for (let row = 0; row < 2; row++) {
      const ky = keyAreaTop + (row + 0.5) * keyRowH;
      // Slight stagger on the bottom row, like a real keyboard
      const stagger = row === 1 ? keyW * 0.35 : 0;
      const cols = row === 1 ? keyCount - 1 : keyCount;
      for (let col = 0; col < cols; col++) {
        const kx = keyAreaLeft + stagger + col * (keyW + keyGap);
        strokes.push(linePts([kx, ky], [kx + keyW, ky], 6));
      }
    }

    // ---- Mouse (small rounded rect, off to the right of the keyboard) ----
    const mouseX = kRight + sd * 0.02;
    const mouseY = kTop + sd * 0.005;
    const mouseW = sd * 0.045;
    const mouseH = sd * 0.075;
    if (mouseX + mouseW < cx + 0.50 * sd) {
      strokes.push(rrectPts(mouseX, mouseY, mouseW, mouseH, mouseW * 0.42, 8, 6));
      // Mouse scroll wheel — short vertical bar near the top of the mouse
      strokes.push(linePts(
        [mouseX + mouseW / 2, mouseY + sd * 0.010],
        [mouseX + mouseW / 2, mouseY + sd * 0.022],
        6
      ));
    }

    return strokes;
  }

  // One scene at a time. State machine: draw → hold → fade → next.
  let ornament = null;
  function spawnOrnament(now) {
    const r = canvas.getBoundingClientRect();
    const w = r.width || 280, h = r.height || 250;
    let cx = w / 2, cy = h / 2;
    if (pointer.active) {
      // Light bias toward the cursor (kept small so the layout still reads
      // as a balanced computer scene).
      cx = cx * 0.85 + pointer.x * 0.15;
      cy = cy * 0.85 + pointer.y * 0.15;
    }
    const scale = 0.96 + Math.random() * 0.08;
    // Palette: ink most of the time; an occasional acid-coloured scene for
    // visual variety. No mood-tinted scenes here — the computer wants a
    // confident draftsman line.
    const palette = Math.random();
    const tint = palette < 0.16 ? animParams.acidRgb : animParams.inkRgb;

    const subpaths = buildComputerStrokes(cx, cy, w, h, scale);
    const totalPoints = subpaths.reduce((acc, s) => acc + s.length, 0);

    ornament = {
      subpaths,
      totalPoints,
      tint,
      startAt: now,
      // 6.5s draw → 1.6s hold → 2.0s fade. Energy modulates draw speed.
      drawMs: 6500 / animParams.energy,
      holdMs: 1600,
      fadeMs: 2000,
      maxWidth: 2.4,
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  let rafHandle = 0;
  function frame(now) {
    rafHandle = requestAnimationFrame(frame);
    const r = canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (!w || !h) return;

    // Paper wash — softens the prior frame so completed scenes fade out.
    const { paperRgb } = animParams;
    ctx.fillStyle = `rgba(${paperRgb.r}, ${paperRgb.g}, ${paperRgb.b}, 0.06)`;
    ctx.fillRect(0, 0, w, h);

    if (!ornament) spawnOrnament(now);
    const o = ornament;
    const elapsed = now - o.startAt;

    if (elapsed >= o.drawMs + o.holdMs + o.fadeMs) {
      ornament = null;
      return;
    }

    let phase, tDraw, fade;
    if (elapsed < o.drawMs) {
      phase = 'draw';
      tDraw = elapsed / o.drawMs;
      fade = 1;
    } else if (elapsed < o.drawMs + o.holdMs) {
      phase = 'hold';
      tDraw = 1;
      fade = 1;
    } else {
      phase = 'fade';
      tDraw = 1;
      fade = 1 - (elapsed - o.drawMs - o.holdMs) / o.fadeMs;
    }

    const headTotal = Math.floor(tDraw * o.totalPoints);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${o.tint.r}, ${o.tint.g}, ${o.tint.b}, ${(0.88 * fade).toFixed(3)})`;
    ctx.lineWidth = o.maxWidth;

    // Walk the sub-paths, drawing each fully or up to the head.
    let drawn = 0;
    let headPoint = null;
    for (const path of o.subpaths) {
      if (drawn >= headTotal) break;
      const remaining = headTotal - drawn;
      const targetIdx = Math.min(path.length - 1, remaining);
      ctx.beginPath();
      ctx.moveTo(path[0][0], path[0][1]);
      for (let i = 1; i <= targetIdx; i++) ctx.lineTo(path[i][0], path[i][1]);
      ctx.stroke();
      if (targetIdx < path.length - 1) headPoint = path[targetIdx];
      drawn += path.length;
    }

    // Wet-ink head dot while still drawing
    if (phase === 'draw' && headPoint) {
      ctx.fillStyle = `rgba(${o.tint.r}, ${o.tint.g}, ${o.tint.b}, ${(0.95 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(headPoint[0], headPoint[1], o.maxWidth * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suppress unused-warning on lerp until/unless re-introduced.
    void lerp;
  }

  function bootAnim() {
    sizeCanvas();
    refreshAnimParams();
    cancelAnimationFrame(rafHandle);
    ornament = null;
    rafHandle = requestAnimationFrame(frame);
  }
  requestAnimationFrame(bootAnim);
  window.addEventListener('resize', () => { sizeCanvas(); ornament = null; });
  // The mood card mutates --mood-color via inline style; observe so the tint
  // tracks mood changes without a reload.
  const moodObserver = new MutationObserver(() => refreshAnimParams());
  moodObserver.observe(document.querySelector('.pf-mood'), { attributes: true, attributeFilter: ['style'] });

  // ---------- avatar: photo (back face) ----------
  const photoInput = document.getElementById('avPhotoInput');
  const photoImg   = document.getElementById('avPhotoImg');
  const photoEmpty = document.getElementById('avPhotoEmpty');
  const photoMat   = document.getElementById('avPhotoMat');
  const uploadBtn  = avatar.querySelector('[data-act="upload"]');
  const removeBtn  = avatar.querySelector('[data-act="remove"]');

  function setPhoto(dataURL) {
    if (!dataURL) {
      photoImg.hidden = true; photoImg.removeAttribute('src');
      photoEmpty.style.display = '';
      photoMat.classList.remove('has-photo');
      profile.photoDataUrl = '';
      saveProfile();
      broadcastAvatarChange();
      return;
    }
    photoImg.src = dataURL;
    photoImg.hidden = false;
    photoEmpty.style.display = 'none';
    photoMat.classList.add('has-photo');
    profile.photoDataUrl = dataURL;
    saveProfile();
    broadcastAvatarChange();
  }
  const _saved = profile.photoDataUrl;
  if (_saved) setPhoto(_saved);

  function readFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const fr = new FileReader();
    fr.onload = () => { setPhoto(fr.result); showToast('Portrait set'); };
    fr.readAsDataURL(file);
  }
  photoInput.addEventListener('change', (e) => readFile(e.target.files[0]));
  uploadBtn.addEventListener('click', (e) => { e.stopPropagation(); photoInput.click(); });
  removeBtn.addEventListener('click', (e) => { e.stopPropagation(); setPhoto(null); });

  ['dragenter','dragover'].forEach(ev =>
    photoMat.addEventListener(ev, (e) => { e.preventDefault(); photoEmpty.classList.add('dragover'); })
  );
  ['dragleave','drop'].forEach(ev =>
    photoMat.addEventListener(ev, (e) => { e.preventDefault(); photoEmpty.classList.remove('dragover'); })
  );
  photoMat.addEventListener('drop', (e) => readFile(e.dataTransfer.files[0]));
  // Editable name + bio in the hero. The canonical fields are
  // profile.name / profile.bio; we also keep .display_name in sync because
  // it's what the navbar / SkillGraph greet the user with.
  if (profile.name) { nameEl.textContent = profile.name; syncMono(); }
  if (profile.bio)  bioEl.innerHTML = profile.bio;
  nameEl.addEventListener('blur', () => {
    const v = nameEl.textContent.trim() || 'Ada';
    profile.name = v;
    if (!profile.display_name) profile.display_name = v;
    saveProfile();
    syncMono();
    showToast('Name saved');
  });
  bioEl.addEventListener('blur', () => {
    profile.bio = bioEl.innerHTML;
    saveProfile();
    showToast('Bio saved');
  });
  // ---------- interest picker modal ----------
  const INTEREST_CATALOG = [
    { dept: 'Math',       items: ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory', 'Logic'] },
    { dept: 'Science',    items: ['Biology', 'Chemistry', 'Physics', 'Astronomy', 'Earth Science', 'Neuroscience'] },
    { dept: 'Tech',       items: ['Compilers', 'Web Dev', 'Game Design', 'AI', 'Robotics', 'Cybersecurity'] },
    { dept: 'Humanities', items: ['Creative Writing', 'Philosophy', 'World History', 'Languages', 'Debate', 'Mythology'] },
    { dept: 'Arts',       items: ['Painting', 'Music', 'Photography', 'Film', 'Theater', 'Design'] },
  ];

  // build modal
  const overlay = document.createElement('div');
  overlay.className = 'pf-modal-overlay';
  overlay.innerHTML = `
    <div class="pf-modal" role="dialog" aria-label="Add interests">
      <div class="pf-modal-head">
        <div>
          <div class="pf-modal-eyebrow">Knowsy · interests</div>
          <h3>What are you <em>into</em>?</h3>
        </div>
        <button class="pf-modal-close" id="pmClose" aria-label="Close">×</button>
      </div>
      <div class="pf-modal-body" id="pmBody"></div>
      <div class="pf-modal-foot">
        <input class="pf-modal-input" id="pmCustom" placeholder="add your own…" spellcheck="false" />
        <button class="pf-modal-add" id="pmAdd">Add</button>
        <button class="pf-modal-done" id="pmDone">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const pmBody = overlay.querySelector('#pmBody');
  INTEREST_CATALOG.forEach(grp => {
    const sec = document.createElement('div');
    sec.className = 'pm-group';
    sec.innerHTML = `<div class="pm-dept">${grp.dept}</div><div class="pm-grid"></div>`;
    const grid = sec.querySelector('.pm-grid');
    grp.items.forEach(label => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pm-opt';
      b.dataset.label = label;
      b.textContent = label;
      b.addEventListener('click', () => b.classList.toggle('is-on'));
      grid.appendChild(b);
    });
    pmBody.appendChild(sec);
  });

  function syncPickerFromChips() {
    const have = new Set([...document.querySelectorAll('.id-meta .pf-chip')]
      .filter(c => !c.classList.contains('pf-chip--add'))
      .map(c => c.textContent.trim()));
    overlay.querySelectorAll('.pm-opt').forEach(o => {
      o.classList.toggle('is-on', have.has(o.dataset.label));
    });
  }
  function openPicker() {
    syncPickerFromChips();
    overlay.classList.add('show');
    setTimeout(() => overlay.querySelector('#pmCustom').focus(), 80);
  }
  function closePicker() { overlay.classList.remove('show'); }

  function makeChip(text) {
    const chip = document.createElement('button');
    chip.className = 'pf-chip is-on';
    chip.innerHTML = '<span class="swatch"></span>' + text;
    chip.addEventListener('click', () => chip.classList.toggle('is-on'));
    return chip;
  }
  function commitFromPicker() {
    const container = document.querySelector('.id-meta');
    const addBtn = container.querySelector('.pf-chip--add');
    const have = new Set([...container.querySelectorAll('.pf-chip')]
      .filter(c => !c.classList.contains('pf-chip--add'))
      .map(c => c.textContent.trim()));
    overlay.querySelectorAll('.pm-opt.is-on').forEach(o => {
      const label = o.dataset.label;
      if (!have.has(label)) container.insertBefore(makeChip(label), addBtn);
    });
    // remove unselected pre-existing
    [...container.querySelectorAll('.pf-chip')].forEach(c => {
      if (c.classList.contains('pf-chip--add')) return;
      const label = c.textContent.trim();
      const inCatalog = INTEREST_CATALOG.some(g => g.items.includes(label));
      if (inCatalog) {
        const stillOn = overlay.querySelector(`.pm-opt[data-label="${CSS.escape(label)}"]`)?.classList.contains('is-on');
        if (!stillOn) c.remove();
      }
    });
    profile.interests = [...container.querySelectorAll('.pf-chip')]
      .filter(c => !c.classList.contains('pf-chip--add'))
      .map(c => c.textContent.trim());
    saveProfile();
    closePicker();
  }

  overlay.querySelector('#pmClose').addEventListener('click', closePicker);
  overlay.querySelector('#pmDone').addEventListener('click', commitFromPicker);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('show')) closePicker(); });

  const customInput = overlay.querySelector('#pmCustom');
  function addCustom() {
    const v = customInput.value.trim();
    if (!v) return;
    // append into a "Yours" group, creating one if needed
    let yours = pmBody.querySelector('[data-yours]');
    if (!yours) {
      yours = document.createElement('div');
      yours.className = 'pm-group';
      yours.dataset.yours = '1';
      yours.innerHTML = `<div class="pm-dept">Yours</div><div class="pm-grid"></div>`;
      pmBody.appendChild(yours);
    }
    const grid = yours.querySelector('.pm-grid');
    if ([...grid.children].some(b => b.dataset.label.toLowerCase() === v.toLowerCase())) {
      customInput.value = ''; return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pm-opt is-on';
    b.dataset.label = v;
    b.textContent = v;
    b.addEventListener('click', () => b.classList.toggle('is-on'));
    grid.appendChild(b);
    customInput.value = '';
  }
  overlay.querySelector('#pmAdd').addEventListener('click', addCustom);
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
  });

  // wire chips
  document.querySelectorAll('.id-meta .pf-chip').forEach(c => {
    if (c.textContent.trim().startsWith('Add')) {
      c.classList.add('pf-chip--add');
      c.addEventListener('click', openPicker);
    } else {
      c.addEventListener('click', () => c.classList.toggle('is-on'));
    }
  });

  // ---------- mood card ----------
  const moods = [
    { glyph: '?', color: '#5B3FFF', label: 'Curious',   energy: 70 },
    { glyph: '◉', color: '#1B2147', label: 'Focused',   energy: 85 },
    { glyph: '!', color: '#C8102E', label: 'Excited',   energy: 95 },
    { glyph: '✶', color: '#C9A24A', label: 'Confident', energy: 75 },
    { glyph: 'z', color: '#4A4F6E', label: 'Tired',     energy: 25 },
    { glyph: 'x', color: '#7A2E2E', label: 'Stuck',     energy: 15 },
  ];
  let moodIdx = Number.isFinite(+profile.mood) ? +profile.mood : 1;
  const moodLabel = document.getElementById('moodLabel');
  const moodStamp = document.getElementById('moodStamp');
  const pickers = document.getElementById('moodPickers');
  const moodCard = document.querySelector('.pf-mood');
  function applyMood(i, opts={}) {
    moodIdx = (i + moods.length) % moods.length;
    const m = moods[moodIdx];
    moodCard.style.setProperty('--mood-color', m.color);
    moodLabel.textContent = m.label.toLowerCase();
    [...pickers.children].forEach((el, idx) => el.classList.toggle('active', idx === moodIdx));
    moodStamp.textContent = 'just now';
    profile.mood = moodIdx;
    saveProfile();
    if (!opts.fromEnergy) setEnergy(m.energy, true);
  }
  moods.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.style.setProperty('--m-color', m.color);
    b.innerHTML = `<span>${m.glyph}</span><span class="tip">${m.label}</span>`;
    b.addEventListener('click', () => applyMood(i));
    pickers.appendChild(b);
  });

  // energy slider (must be initialized before first applyMood)
  const slider = document.getElementById('energySlider');
  const fill   = document.getElementById('energyFill');
  const knob   = document.getElementById('energyKnob');
  const energyVal = document.getElementById('energyVal');
  let energy = Number.isFinite(+profile.energy) ? +profile.energy : 68;

  applyMood(moodIdx);
  function setEnergy(v, save) {
    energy = Math.max(0, Math.min(100, Math.round(v)));
    fill.style.width = energy + '%';
    knob.style.left  = energy + '%';
    energyVal.textContent = energy;
    if (save) { profile.energy = energy; saveProfile(); }
    // pick nearest mood by energy
    let best = 0, bestD = Infinity;
    moods.forEach((m, i) => { const d = Math.abs(m.energy - energy); if (d < bestD) { bestD = d; best = i; } });
    if (best !== moodIdx) applyMood(best, { fromEnergy: true });
  }
  setEnergy(energy, false);
  let dragSlider = false;
  function fromEvent(e) {
    const r = slider.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  }
  slider.addEventListener('pointerdown', (e) => { dragSlider = true; slider.setPointerCapture(e.pointerId); setEnergy(fromEvent(e), true); });
  slider.addEventListener('pointermove', (e) => { if (dragSlider) setEnergy(fromEvent(e), true); });
  slider.addEventListener('pointerup',   () => { dragSlider = false; });

  // ---------- ledger / XP / streak / modules / days ----------
  // Wired to real data: XP from profile (the leaderboard / module engine
  // updates this), streak from profile, modules-done = unique submitted
  // widget IDs over the registry size, days = days since profile.joinedAt.
  let xp = profile.xp || profile.leaderboard?.totalXp || 0;
  let level = Math.max(1, Math.floor((xp + 200) / 300));
  let streak = profile.streak || 0;
  function need() { return 200 + level * 100; }

  // Tiny helper: write a property only if the element exists. The original
  // design referenced #navStreak/#navLevel/#navXP/#navXPBar from its inline
  // navbar; we replaced that with the persistent .knav component, so those
  // IDs don't exist in this page anymore. Without the guard, the very first
  // null deref tore down the rest of the IIFE and every section below it
  // rendered empty.
  function set(id, prop, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === 'width') el.style.width = value;
    else el[prop] = value;
  }

  // Registry import for module-count denominator. Lazy so the radar / progress
  // can't fail if registry.js fails to load.
  let registrySize = 0;
  import('./registry.js')
    .then((mod) => {
      registrySize = (mod.WIDGETS || []).length;
      renderLedger();
    })
    .catch(() => { /* leave 0 */ });

  function modulesDone() {
    const subs = window.__profileSubmissions || [];
    return new Set(subs.map((s) => s.widget).filter(Boolean)).size;
  }
  function daysSinceJoin() {
    if (!profile.joinedAt) return 0;
    const ms = Date.now() - new Date(profile.joinedAt).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.floor(ms / 86400000);
  }
  function renderLedger() {
    const cap = need();
    const pct = Math.max(0, Math.min(100, (xp / cap) * 100));
    set('xpBig',     'textContent', xp);
    set('xpBarBig',  'width',       pct + '%');
    set('streakBig', 'textContent', streak);
    set('daysBig',   'textContent', daysSinceJoin());
    const done = modulesDone();
    set('modulesBig','textContent', done);
    if (registrySize > 0) {
      const modPct = Math.max(0, Math.min(100, (done / registrySize) * 100));
      set('moduleBarBig', 'width', modPct + '%');
      const subEl = document.querySelector('.pf-ledger .cell:nth-child(1) .num small');
      if (subEl) subEl.textContent = `/ ${registrySize}`;
    }
  }
  renderLedger();


  // ---------- skill radar (auto-derived from real submissions) ----------
  // Skills are aggregated from SubmissionStore: each skill gets an axis
  // proportional to its average passed score, scaled by attempt count so
  // skills you've actually engaged with stretch farther than a single one-off
  // submission. No more drag — the radar reflects what the data says.
  const radarEl = document.getElementById('radar');
  const skillListEl = document.getElementById('skillList');
  const VW = 600, VH = 460, CX = VW/2, CY = VH/2, R = 180;
  const SKILL_LABELS = {
    numbers: 'Numbers', logic: 'Logic', programming: 'Code',
    mechanics: 'Mechanics', electronics: 'Circuits', math: 'Math',
    chemistry: 'Chemistry', astronomy: 'Astronomy', geography: 'Geography',
    language: 'Language', vision: 'Vision', communication: 'Writing',
  };
  function deriveSkills(submissions, skillAreas) {
    // Aggregate per skill: attempts + passed + avg score
    const agg = new Map();
    for (const s of submissions || []) {
      const key = String(s.skill || '').trim();
      if (!key) continue;
      if (!agg.has(key)) agg.set(key, { attempts: 0, passed: 0, scoreSum: 0 });
      const a = agg.get(key);
      a.attempts += 1;
      if (s.passed) a.passed += 1;
      a.scoreSum += Math.max(0, Math.min(1, +s.score || 0));
    }
    // Fold in any skillAreas the user has self-tracked (xp values) — gives
    // a non-zero axis for areas where there are no submissions yet but the
    // module engine has awarded XP.
    for (const [k, xp] of Object.entries(skillAreas || {})) {
      if (!agg.has(k)) agg.set(k, { attempts: 0, passed: 0, scoreSum: 0 });
      agg.get(k).xp = +xp || 0;
    }
    const arr = [...agg.entries()].map(([key, a]) => {
      const avgScore = a.attempts ? a.scoreSum / a.attempts : 0;
      // mastery 0..1: 60% from avg score, 40% from log(attempts) reach
      const reach = Math.min(1, Math.log2(1 + a.attempts) / 4);
      const xpPart = Math.min(1, (a.xp || 0) / 400);
      const val = Math.max(0.05, Math.min(1, 0.5 * avgScore + 0.3 * reach + 0.2 * xpPart));
      return {
        key,
        name: SKILL_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1)),
        val,
        attempts: a.attempts,
        passed: a.passed,
        avgScore,
      };
    });
    // Top 6 by attempts, tie-break by avg score
    arr.sort((a, b) => (b.attempts - a.attempts) || (b.avgScore - a.avgScore));
    return arr.slice(0, 6);
  }
  function angleFor(i, n) { return -Math.PI/2 + (i / n) * Math.PI * 2; }
  function pointFor(i, val, n) {
    const a = angleFor(i, n);
    return [CX + Math.cos(a) * R * val, CY + Math.sin(a) * R * val];
  }
  function buildRadar() {
    const subs = window.__profileSubmissions || [];
    const skills = deriveSkills(subs, profile.skillAreas);

    if (!skills.length) {
      radarEl.innerHTML = '<div class="radar-empty">Complete a few exercises to unlock your skill shape.</div>';
      if (skillListEl) skillListEl.innerHTML = '<div class="skill"><span class="name">No data yet</span><span class="val">—</span></div>';
      return;
    }

    const n = skills.length;
    let svg = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet">`;
    [0.25, 0.5, 0.75, 1.0].forEach(t => {
      svg += `<circle class="grid-circle" cx="${CX}" cy="${CY}" r="${R*t}"/>`;
    });
    skills.forEach((s, i) => {
      const a = angleFor(i, n);
      const ex = CX + Math.cos(a) * R, ey = CY + Math.sin(a) * R;
      svg += `<line class="axis" x1="${CX}" y1="${CY}" x2="${ex}" y2="${ey}"/>`;
      const lx = CX + Math.cos(a) * (R + 32);
      const ly = CY + Math.sin(a) * (R + 32);
      svg += `<text class="axis-label" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(s.name)}</text>`;
    });
    const pts = skills.map((s, i) => pointFor(i, s.val, n).join(',')).join(' ');
    svg += `<polygon class="area-fill" points="${pts}"/>`;
    skills.forEach((s, i) => {
      const [x, y] = pointFor(i, s.val, n);
      svg += `<circle class="handle is-static" cx="${x}" cy="${y}" r="5"/>`;
    });
    svg += '</svg>';
    radarEl.innerHTML = svg;

    if (skillListEl) {
      skillListEl.innerHTML = skills.map((s) => `
        <div class="skill">
          <span class="name">${escapeHtml(s.name)}</span>
          <span class="val">
            <b>${Math.round(s.val * 100)}</b>/100
            <small style="display:block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--ink-soft);text-transform:uppercase;margin-top:2px;">
              ${s.passed}/${s.attempts} passed · avg ${Math.round(s.avgScore * 100)}%
            </small>
          </span>
        </div>
      `).join('');
    }
  }
  buildRadar();

  // ---------- 365-day heatmap ----------
  const heatGrid = document.getElementById('heatGrid');
  const heatTip = document.getElementById('heatTip');
  const heatRoot = document.getElementById('heat');
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 364);
  // start on Monday
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
  // Heatmap is derived live from SubmissionStore (count of submissions per
  // day) layered with profile.heatManual (user click-to-bump overrides). No
  // more random seeding — the graph reflects the real record. Dispatched
  // 'knowsy:submissions-updated' triggers a repaint without reload.
  function lvl(v) { return ['','l1','l2','l3','l4'][Math.max(0, Math.min(4, v))]; }
  function dayKey(d) { return d.toISOString().slice(0,10); }
  function aggregateHeat() {
    const subs = window.__profileSubmissions || [];
    const auto = {};
    for (const s of subs) {
      if (!s?.ts) continue;
      const d = new Date(+s.ts);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      auto[k] = (auto[k] || 0) + 1;
    }
    const manual = profile.heatManual && typeof profile.heatManual === 'object' ? profile.heatManual : {};
    // auto count → level (capped at 4). Manual override wins when present.
    function level(k) {
      if (manual[k] != null) return Math.max(0, Math.min(4, +manual[k]));
      const c = auto[k] || 0;
      if (c <= 0) return 0;
      if (c === 1) return 1;
      if (c === 2) return 2;
      if (c <= 4) return 3;
      return 4;
    }
    return { auto, level };
  }
  function buildHeat() {
    heatGrid.innerHTML = '';
    const { auto, level } = aggregateHeat();
    const manual = profile.heatManual || {};
    const total = 365;
    for (let i = 0; i < total; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = dayKey(d);
      const lv = level(k);
      const day = document.createElement('button');
      day.className = 'day ' + lvl(lv);
      day.dataset.k = k;
      day.dataset.v = String(lv);
      day.dataset.count = String(auto[k] || 0);
      day.dataset.manual = manual[k] != null ? '1' : '0';
      day.title = '';
      day.addEventListener('mouseenter', (e) => {
        const r = e.target.getBoundingClientRect();
        const rr = heatRoot.getBoundingClientRect();
        heatTip.style.left = (r.left + r.width/2 - rr.left) + 'px';
        heatTip.style.top  = (r.top - rr.top) + 'px';
        const c = +day.dataset.count;
        const tail = c ? `${c} submission${c === 1 ? '' : 's'}` : 'no record';
        heatTip.textContent = `${k} · ${tail}`;
        heatTip.classList.add('show');
      });
      day.addEventListener('mouseleave', () => heatTip.classList.remove('show'));
      day.addEventListener('click', () => {
        // Click-to-bump still works as a manual override (e.g. logged a
        // self-study session that didn't have a graded submission).
        const cur = +day.dataset.v;
        const next = (cur + 1) % 5;
        if (!profile.heatManual) profile.heatManual = {};
        if (next === 0) delete profile.heatManual[k];
        else profile.heatManual[k] = next;
        saveProfile();
        buildHeat();
      });
      heatGrid.appendChild(day);
    }
  }
  buildHeat();
  window.addEventListener('knowsy:submissions-updated', buildHeat);

  // ---------- achievement vault ----------
  const achievements = [
    { num: '01', glyph: 'π', name: 'First <em>steps</em>', desc: 'Finished your very first module.', unlocked: true,  stamp: 'Earned · Sept 12' },
    { num: '02', glyph: '7d', name: 'Week <em>warrior</em>',   desc: 'Studied seven days in a row.',  unlocked: true,  stamp: 'Earned · Oct 04' },
    { num: '03', glyph: '∑', name: 'Number <em>whisperer</em>',desc: 'Completed the entire Numbers track.', unlocked: true,  stamp: 'Earned · Nov 21' },
    { num: '04', glyph: '✶', name: 'Cohort <em>star</em>',     desc: 'Helped a teammate solve their challenge.', unlocked: true, stamp: 'Earned · Dec 02' },
    { num: '05', glyph: '⌬', name: 'Cell <em>biology</em>',    desc: 'Took your first lab in Biology.', unlocked: true, isNew: true, stamp: 'New · 2 days ago' },
    { num: '06', glyph: '∞', name: '100 <em>hours</em>',       desc: 'Studied a hundred hours total.', unlocked: true, stamp: 'Earned · Feb 14' },
    { num: '07', glyph: '?', name: 'Locked',  desc: 'Ask three questions in cohort chat.', unlocked: false, stamp: '0 / 3' },
    { num: '08', glyph: '⌘', name: 'Locked',  desc: 'Reach Level 5.', unlocked: false, stamp: '4 / 5' },
  ];
  const vault = document.getElementById('vault');
  achievements.forEach(a => {
    const card = document.createElement('div');
    card.className = 'pf-card' + (a.unlocked ? ' unlocked' : ' locked') + (a.isNew ? ' is-new' : '');
    card.innerHTML = `
      <div class="inner">
        <div class="face front">
          <div class="num">No. ${a.num}</div>
          <div class="glyph">${a.glyph}</div>
          <div class="ach-name">${a.unlocked ? a.name : 'Locked'}</div>
        </div>
        <div class="face back">
          <div class="num">No. ${a.num}</div>
          <div class="desc">${a.desc}</div>
          <div class="stamp">${a.stamp}</div>
        </div>
      </div>`;
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      if (a.isNew) { card.classList.remove('is-new'); a.isNew = false; }
    });
    vault.appendChild(card);
  });

  // ---------- pinnable notes wall ----------
  const wall = document.getElementById('wall');
  const seedNotes = [
    { x: 28,  y: 60,  c: 'color-paper', text: 'Two\'s complement is just clock arithmetic in disguise.', meta: 'Module 30 — note' },
    { x: 240, y: 110, c: 'color-coral', text: 'Float ≠ exact. Trust nothing past 7 digits.', meta: 'Aha · Mar 04' },
    { x: 460, y: 50,  c: 'color-acid',  text: 'A bit is a question, not an answer.', meta: 'Lecture quote' },
    { x: 690, y: 140, c: 'color-ink',   text: 'TODO: write the bit interpreter for fun.', meta: 'Goal · this week' },
    { x: 100, y: 260, c: 'color-paper', text: 'When stuck, change the basis.', meta: 'My own rule' },
    { x: 380, y: 280, c: 'color-coral', text: 'IEEE-754 is a haiku written by a committee.', meta: 'Reading note' },
  ];
  function makeNote(n) {
    const el = document.createElement('div');
    el.className = 'pf-note ' + n.c;
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    el.innerHTML = `<div class="pin"></div><div class="text" contenteditable="false">${n.text}</div><div class="nmeta">${n.meta}</div>`;
    el.addEventListener('dblclick', () => {
      const t = el.querySelector('.text');
      t.contentEditable = 'true'; t.focus();
      t.addEventListener('blur', () => { t.contentEditable = 'false'; showToast('Note edited'); }, { once: true });
    });
    let dragging = false, ox = 0, oy = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.text[contenteditable="true"]')) return;
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      el.classList.add('dragging'); el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const wr = wall.getBoundingClientRect();
      const x = Math.max(0, Math.min(wr.width - el.offsetWidth, e.clientX - wr.left - ox));
      const y = Math.max(0, Math.min(wr.height - el.offsetHeight, e.clientY - wr.top - oy));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    });
    el.addEventListener('pointerup', () => { dragging = false; el.classList.remove('dragging'); });
    wall.appendChild(el);
  }
  seedNotes.forEach(makeNote);
  document.getElementById('addNoteBtn').addEventListener('click', () => {
    const colors = ['color-paper','color-coral','color-acid','color-ink'];
    makeNote({ x: 60 + Math.random()*200, y: 60 + Math.random()*120, c: colors[Math.floor(Math.random()*4)], text: 'New thought…', meta: 'Just now' });
    showToast('Note pinned');
  });
  document.getElementById('shuffleBtn').addEventListener('click', () => {
    const wr = wall.getBoundingClientRect();
    wall.querySelectorAll('.pf-note').forEach(el => {
      el.style.transition = 'transform .5s cubic-bezier(.6,0,.2,1), left .5s cubic-bezier(.6,0,.2,1), top .5s cubic-bezier(.6,0,.2,1)';
      el.style.left = Math.random() * (wr.width - 220) + 'px';
      el.style.top  = Math.random() * (wr.height - 180) + 'px';
      setTimeout(() => el.style.transition = '', 600);
    });
    showToast('Reshuffled');
  });

  // ---------- classes (.ics upload + manual entry, persisted to profile) ----------
  const classesEl = document.getElementById('classes');
  const clsIcsInput = document.getElementById('clsIcsInput');
  const clsAddBtn = document.getElementById('clsAddBtn');
  const clsClearBtn = document.getElementById('clsClearBtn');

  const DAY_LABELS = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
  function whenFromDays(days) {
    if (!Array.isArray(days) || !days.length) return '';
    return days.map((d) => DAY_LABELS[d] || d).join(' · ');
  }
  function avaFromCode(code, name) {
    const c = String(code || '').replace(/\s+/g, '').toUpperCase();
    if (!c) return (String(name || '?').slice(0, 3) || '?').toUpperCase();
    // For Rutgers-style "14:332:382" → "382". For "ECE382" → "ECE".
    const tail = c.split(':').pop();
    return tail.length <= 4 ? tail : tail.slice(0, 4);
  }

  function paintClasses() {
    const list = Array.isArray(profile.enrolledClasses) ? profile.enrolledClasses : [];
    classesEl.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'cls-empty';
      empty.innerHTML = `<em>No classes yet.</em><p>Upload an <code>.ics</code> from WebReg or click <b>Add manually</b>.</p>`;
      classesEl.appendChild(empty);
      return;
    }
    list.forEach((c, idx) => {
      const when = c.when || whenFromDays(c.days);
      const f = document.createElement('div');
      f.className = 'pf-friend ' + (c.tone || '');
      f.innerHTML = `
        <button class="cls-x" type="button" aria-label="Remove">×</button>
        <div class="ava">${escapeHtml(avaFromCode(c.code, c.name))}</div>
        <div class="nm">${escapeHtml(c.name || c.code || 'Class')}</div>
        <div class="dept-badge">${escapeHtml(c.dept || '')}</div>
        <div class="role">${escapeHtml(when || '—')}</div>
        <div class="pop">${escapeHtml([c.code, c.dept, when, c.location].filter(Boolean).join(' · '))}</div>
      `;
      f.querySelector('.cls-x').addEventListener('click', (e) => {
        e.stopPropagation();
        profile.enrolledClasses = list.filter((_, i) => i !== idx);
        saveProfile();
        paintClasses();
        showToast('Removed');
      });
      f.addEventListener('click', () => showToast(`${c.code || ''} · ${c.name || ''}`.trim()));
      classesEl.appendChild(f);
    });
  }

  // ICS parser — handles WebReg / Schedule Builder exports. Each VEVENT is a
  // course meeting; multiple VEVENTs can share a SUMMARY (different days /
  // sections) so we coalesce by SUMMARY+LOCATION and union the days.
  function parseICS(text) {
    // Unfold lines ("\n " or "\n\t" continues the prior line)
    const unfolded = String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
    const events = [];
    let cur = null;
    for (const line of unfolded.split('\n')) {
      if (line === 'BEGIN:VEVENT') cur = {};
      else if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; }
      else if (cur) {
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        const keyPart = line.slice(0, idx);
        const value = line.slice(idx + 1);
        const baseKey = keyPart.split(';')[0].toUpperCase();
        if (baseKey === 'SUMMARY') cur.summary = value.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        else if (baseKey === 'LOCATION') cur.location = value.replace(/\\,/g, ',').trim();
        else if (baseKey === 'DTSTART') cur.dtstart = value;
        else if (baseKey === 'DTEND') cur.dtend = value;
        else if (baseKey === 'RRULE') cur.rrule = value;
      }
    }
    function timeFromDt(dt) {
      // "20260120T103500" or "20260120T143000Z"
      const m = String(dt || '').match(/T(\d{2})(\d{2})/);
      return m ? `${m[1]}:${m[2]}` : '';
    }
    function daysFromRRule(r) {
      const m = String(r || '').match(/BYDAY=([A-Z,]+)/);
      if (!m) return [];
      return m[1].split(',').filter(Boolean);
    }
    function deptFromSummary(s) {
      // "ECE 14:332:382 Embedded Systems" → ECE; "Math 251" → Math
      const m = String(s || '').match(/^\s*([A-Za-z]{2,8})\b/);
      return m ? m[1].toUpperCase() : '';
    }
    function codeAndName(summary) {
      // Rutgers SOC summary often: "01:198:111 - Intro to Computer Science"
      // or "14:332:382 Embedded Systems (LEC 01)".
      const s = String(summary || '').trim();
      const codeMatch = s.match(/(\d{2}:\d{3}:\d{3})|([A-Z]{2,4}\s?\d{2,4}[A-Z]?)/);
      const code = codeMatch ? codeMatch[0].trim() : '';
      let name = code ? s.replace(code, '').replace(/^[\s-:—–]+/, '').replace(/\s+\(.*\)\s*$/, '').trim() : s;
      return { code, name };
    }

    const merged = new Map();
    for (const ev of events) {
      const { code, name } = codeAndName(ev.summary);
      const key = (code || ev.summary || '') + '|' + (ev.location || '');
      const days = daysFromRRule(ev.rrule);
      const startTime = timeFromDt(ev.dtstart);
      const endTime = timeFromDt(ev.dtend);
      if (!merged.has(key)) {
        merged.set(key, {
          code: code || '',
          name: name || ev.summary || 'Class',
          dept: deptFromSummary(ev.summary),
          location: ev.location || '',
          days: [],
          startTime,
          endTime,
          tone: '',
        });
      }
      const c = merged.get(key);
      const toAdd = days.length ? days : [];
      // Try to infer day from DTSTART weekday if RRULE missing
      if (!toAdd.length && ev.dtstart) {
        const m = ev.dtstart.match(/^(\d{4})(\d{2})(\d{2})/);
        if (m) {
          const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).getUTCDay();
          const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          toAdd.push(map[d]);
        }
      }
      for (const d of toAdd) if (!c.days.includes(d)) c.days.push(d);
      if (!c.startTime && startTime) c.startTime = startTime;
      if (!c.endTime && endTime) c.endTime = endTime;
    }
    const out = [];
    for (const c of merged.values()) {
      const ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      c.days.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      c.when = whenFromDays(c.days);
      out.push(c);
    }
    return out;
  }

  if (clsIcsInput) {
    clsIcsInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseICS(text);
        if (!parsed.length) { showToast('No classes found in that file'); return; }
        const merged = [...(profile.enrolledClasses || []), ...parsed];
        // Dedupe by code+name
        const seen = new Set();
        profile.enrolledClasses = merged.filter((c) => {
          const k = (c.code || '') + '|' + (c.name || '');
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        saveProfile();
        paintClasses();
        showToast(`Loaded ${parsed.length} class${parsed.length === 1 ? '' : 'es'}`);
      } catch (err) {
        console.error('ics parse failed', err);
        showToast('Could not read that file');
      }
      e.target.value = '';
    });
  }

  // ---- Manual entry modal ----
  function openClassModal() {
    const ov = document.createElement('div');
    ov.className = 'pf-modal-overlay show';
    ov.innerHTML = `
      <div class="pf-modal cls-modal" role="dialog" aria-label="Add a class">
        <div class="pf-modal-head">
          <div>
            <div class="pf-modal-eyebrow">Knowsy · classes</div>
            <h3>Add a <em>class</em>.</h3>
          </div>
          <button class="pf-modal-close" id="clsModalClose" aria-label="Close">×</button>
        </div>
        <div class="pf-modal-body">
          <div class="cls-form">
            <label>Code<input id="clsCode" placeholder="14:332:382 or ECE 382"></label>
            <label>Name<input id="clsName" placeholder="Embedded Systems"></label>
            <label>Department<input id="clsDept" placeholder="ECE · CS · Math"></label>
            <label>When (free text)<input id="clsWhen" placeholder="Mon · Wed · Fri"></label>
            <label class="cls-form-days">Days
              <span class="cls-day-row">
                ${['MO','TU','WE','TH','FR'].map((d) => `<label><input type="checkbox" data-day="${d}"> ${DAY_LABELS[d]}</label>`).join('')}
              </span>
            </label>
            <label>Location<input id="clsLoc" placeholder="EE 105"></label>
          </div>
        </div>
        <div class="pf-modal-foot">
          <button class="pf-modal-done" id="clsModalSave">Add class</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.querySelector('#clsModalClose').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelector('#clsModalSave').addEventListener('click', () => {
      const code = ov.querySelector('#clsCode').value.trim();
      const name = ov.querySelector('#clsName').value.trim();
      const dept = ov.querySelector('#clsDept').value.trim();
      const when = ov.querySelector('#clsWhen').value.trim();
      const loc  = ov.querySelector('#clsLoc').value.trim();
      const days = [...ov.querySelectorAll('input[data-day]:checked')].map((i) => i.dataset.day);
      if (!code && !name) { showToast('Need a code or a name'); return; }
      const next = (profile.enrolledClasses || []).slice();
      next.push({
        code, name: name || code, dept,
        when: when || whenFromDays(days),
        days, location: loc, tone: '',
      });
      profile.enrolledClasses = next;
      saveProfile();
      paintClasses();
      close();
      showToast('Class added');
    });
    setTimeout(() => ov.querySelector('#clsCode')?.focus(), 80);
  }

  if (clsAddBtn) clsAddBtn.addEventListener('click', openClassModal);
  if (clsClearBtn) clsClearBtn.addEventListener('click', () => {
    if (!confirm('Remove all classes from your profile?')) return;
    profile.enrolledClasses = [];
    saveProfile();
    paintClasses();
    showToast('Cleared');
  });

  paintClasses();

  // ---------- progress / submissions (No. 06) ----------
  // SubmissionStore is the assessment archive used by every Practice widget.
  // We load once and share the array with the skill radar (window.__profileSubmissions).
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDuration(ms) {
    if (!ms || !Number.isFinite(+ms)) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const progressEl = document.getElementById('pfProgress');
  const completedListEl = document.getElementById('pfCompletedList');

  function paintProgress(submissions) {
    window.__profileSubmissions = submissions;
    if (progressEl) {
      const passed = submissions.filter((s) => s.passed).length;
      const attempts = submissions.length;
      const skillsCovered = new Set(submissions.map((s) => s.skill).filter(Boolean)).size;
      const widgetsTouched = new Set(submissions.map((s) => s.widget).filter(Boolean)).size;
      const totalXp = submissions.reduce((acc, s) => acc + (+s.xpAwarded || 0), 0);
      const recent = [...submissions]
        .filter((s) => s.ts)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 4);
      const recentHtml = recent.length
        ? recent.map((s) => {
            const when = new Date(s.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const tag = s.module || s.skill || s.widget || s.assessmentId || '—';
            const ok = s.passed ? '✓' : '·';
            return `<div><b>${escapeHtml(tag)}</b> · ${Math.round((s.score || 0) * 100)}% · ${when} ${ok}</div>`;
          }).join('')
        : '<div>No submissions yet.</div>';

      progressEl.innerHTML = `
        <div class="cell">
          <div class="lab">Submitted</div>
          <div class="num"><em>${attempts}</em><small>total</small></div>
          <div class="sub">${passed} passed · ${attempts - passed} attempts</div>
        </div>
        <div class="cell">
          <div class="lab">Skills</div>
          <div class="num"><em>${skillsCovered}</em><small>tagged</small></div>
          <div class="sub">across ${widgetsTouched} module${widgetsTouched === 1 ? '' : 's'}</div>
        </div>
        <div class="cell">
          <div class="lab">Streak</div>
          <div class="num"><em>${profile.streak || 0}</em><small>days</small></div>
          <div class="sub">earned XP · ${totalXp || profile.xp || profile.leaderboard?.totalXp || 0}</div>
        </div>
        <div class="cell">
          <div class="lab">Recent</div>
          <div class="recent">${recentHtml}</div>
        </div>
      `;
    }

    // Detailed completed-work table — feels like a real LMS gradebook row.
    if (completedListEl) {
      const sorted = [...submissions].sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (!sorted.length) {
        completedListEl.innerHTML = `
          <div class="cw-empty">
            <em>No assignments yet.</em>
            <p>Open a module from the catalog and finish a guided exercise. Your record builds itself from there.</p>
          </div>`;
      } else {
        completedListEl.innerHTML = sorted.map((s) => {
          const pct = Math.round((s.score || 0) * 100);
          const when = s.ts ? new Date(s.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          const dur = fmtDuration(s.durationMs);
          const status = s.passed ? 'pass' : 'fail';
          const statusLab = s.passed ? '✓ pass' : '✗ retry';
          const diff = s.difficulty ? `<span class="cw-diff" data-diff="${escapeHtml(s.difficulty)}">${escapeHtml(s.difficulty)}</span>` : '';
          const rubricRows = (s.rubric || []).map((r) => `
            <li>
              <span class="cw-rub-name">${escapeHtml(r.criterion)}</span>
              <span class="cw-rub-pts">${Number(r.points ?? 0).toFixed(2)} / ${Number(r.weight ?? 0).toFixed(2)}</span>
              <span class="cw-rub-mark" data-passed="${r.passed ? '1' : '0'}">${r.passed ? '✓' : '✗'}</span>
            </li>`).join('');
          const writeup = s.writeup ? `<div class="cw-writeup"><b>Writeup ·</b> ${escapeHtml(s.writeup)}</div>` : '';
          const feedback = s.feedback ? `<div class="cw-feedback"><b>Feedback ·</b> ${escapeHtml(s.feedback)}</div>` : '';

          return `
            <details class="cw-row" data-status="${status}">
              <summary>
                <span class="cw-when">${when}</span>
                <span class="cw-title">${escapeHtml(s.module || s.assessmentId || s.widget || '—')}</span>
                <span class="cw-skill">${escapeHtml(s.skill || '')}</span>
                ${diff}
                <span class="cw-pct"><em>${pct}%</em></span>
                <span class="cw-status" data-status="${status}">${statusLab}</span>
              </summary>
              <div class="cw-detail">
                <div class="cw-detail-meta">
                  <span><b>Module ·</b> ${escapeHtml(s.module || '—')}</span>
                  <span><b>Category ·</b> ${escapeHtml(s.category || '—')}</span>
                  <span><b>Attempts ·</b> ${s.attempts ?? 1}</span>
                  <span><b>Time ·</b> ${dur}</span>
                  <span><b>XP ·</b> ${s.xpAwarded ?? 0}</span>
                  <span><b>Level ·</b> ${s.level ?? '—'}</span>
                </div>
                ${rubricRows ? `<ul class="cw-rubric">${rubricRows}</ul>` : ''}
                ${writeup}
                ${feedback}
              </div>
            </details>`;
        }).join('');
      }
    }

    // Repaint the radar + ledger + heatmap now that submissions are loaded
    // so modules-done count, skill axes, recent-XP, and the activity grid
    // all reflect reality.
    if (typeof buildRadar === 'function') buildRadar();
    if (typeof renderLedger === 'function') renderLedger();
    if (typeof buildHeat === 'function') buildHeat();
  }

  // The full XP / SubmissionStore stack lives only in the integration repo.
  // Prod ships the two showcase widgets, so we paint the empty progress
  // panel and leave the radar / ledger / heatmap to fall back to placeholders.
  paintProgress([]);

  // ---------- account: color vision card (No. 07) ----------
  const cvCard = document.querySelector('.pf-color-card');
  const cvTitle = document.getElementById('cvTitle');
  const cvBody  = document.getElementById('cvBody');
  const cvMeta  = document.getElementById('cvMeta');
  const cvLink  = document.getElementById('cvLink');
  function paintColorVision() {
    const cv = profile.colorVision || {};
    const cls = cv.classification || 'not_assessed';
    cvCard?.setAttribute('data-cv', cls);
    const titles = {
      not_assessed: 'Not yet checked',
      likely_normal: 'Likely normal',
      possible_red_green_deficiency: 'Possible red–green',
      possible_tritan_deficiency: 'Possible tritan',
      inconclusive: 'Inconclusive',
    };
    if (cvTitle) cvTitle.textContent = titles[cls] || titles.not_assessed;
    if (cvBody)  cvBody.textContent = cv.summaryLine || 'Run the screening once and we\'ll keep the result on file.';
    if (cvMeta) {
      const when = cv.lastScreeningAt ? new Date(cv.lastScreeningAt).toLocaleDateString() : '—';
      const score = cv.platesMatchedNormal != null && cv.platesTotal != null
        ? `${cv.platesMatchedNormal}/${cv.platesTotal} plates`
        : '';
      cvMeta.textContent = [when !== '—' ? `Last · ${when}` : null, score].filter(Boolean).join('  ·  ');
    }
    if (cvLink) cvLink.textContent = cls === 'not_assessed' ? 'Take the test →' : 'Re-take →';
  }
  paintColorVision();

  // ---------- account: identity rows (editable) ----------
  // Editorial-style two-line rows: label · input · public toggle.
  const idGrid = document.getElementById('pfIdentity');
  const connectGrid = document.getElementById('pfConnect');

  function visToBool(slot) {
    return slot && slot.visibility === VISIBILITY.PUBLIC;
  }
  function boolToVis(on) {
    return on ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE;
  }
  function row(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'pf-id-row';
    wrap.innerHTML = `
      <span class="pf-id-lab">${escapeHtml(opts.label)}</span>
      <input class="pf-id-input" type="${opts.type || 'text'}" placeholder="${escapeHtml(opts.placeholder || '')}" value="${escapeHtml(opts.value || '')}">
      ${opts.hidePublic ? '<span></span>' : `<label class="pf-id-vis ${opts.public ? 'is-on' : ''}"><input type="checkbox" ${opts.public ? 'checked' : ''}><span>Public</span></label>`}
    `;
    const inp = wrap.querySelector('input.pf-id-input');
    const cb = wrap.querySelector('.pf-id-vis input');
    const visEl = wrap.querySelector('.pf-id-vis');
    inp.addEventListener('change', () => {
      opts.onValue?.(inp.value.trim());
      saveProfile();
      showToast('Saved');
    });
    if (cb) {
      cb.addEventListener('change', () => {
        visEl?.classList.toggle('is-on', cb.checked);
        opts.onPublic?.(cb.checked);
        saveProfile();
      });
    }
    return wrap;
  }

  function renderIdentity() {
    if (!idGrid || !connectGrid) return;
    idGrid.innerHTML = '';
    connectGrid.innerHTML = '';

    idGrid.appendChild(row({
      label: 'Display name', placeholder: 'How we greet you',
      value: profile.display_name || profile.preferredName || '',
      public: !!profile.preferredNamePublic,
      onValue: (v) => { profile.display_name = v; profile.preferredName = v; },
      onPublic: (on) => { profile.preferredNamePublic = on; },
    }));
    idGrid.appendChild(row({
      label: 'Pronouns', placeholder: 'she/her · they/them',
      value: profile.pronouns || '',
      hidePublic: true,
      onValue: (v) => { profile.pronouns = v; },
    }));
    idGrid.appendChild(row({
      label: 'Email', type: 'email', placeholder: 'you@example.com',
      value: profile.email?.value || profile.contact?.email || '',
      public: visToBool(profile.email),
      onValue: (v) => {
        profile.email = { value: v, visibility: profile.email?.visibility || VISIBILITY.PRIVATE };
      },
      onPublic: (on) => {
        profile.email = { value: profile.email?.value || '', visibility: boolToVis(on) };
      },
    }));
    idGrid.appendChild(row({
      label: 'Phone', type: 'tel', placeholder: '+1 555 …',
      value: profile.phone?.value || profile.contact?.phone || '',
      public: visToBool(profile.phone),
      onValue: (v) => {
        profile.phone = { value: v, visibility: profile.phone?.visibility || VISIBILITY.PRIVATE };
      },
      onPublic: (on) => {
        profile.phone = { value: profile.phone?.value || '', visibility: boolToVis(on) };
      },
    }));
    idGrid.appendChild(row({
      label: 'Birthday', type: 'date',
      value: profile.birthday || '',
      public: !!profile.birthdayPublic,
      onValue: (v) => { profile.birthday = v; },
      onPublic: (on) => { profile.birthdayPublic = on; },
    }));
    idGrid.appendChild(row({
      label: 'Department', placeholder: 'ECE · CS · Math',
      value: profile.department || '',
      hidePublic: true,
      onValue: (v) => { profile.department = v; },
    }));

    connectGrid.appendChild(row({
      label: 'GitHub', placeholder: 'username',
      value: profile.github || profile.githubId || '',
      public: !!profile.githubPublic,
      onValue: (v) => { profile.github = v; profile.githubId = v; },
      onPublic: (on) => { profile.githubPublic = on; },
    }));
    connectGrid.appendChild(row({
      label: 'LinkedIn', placeholder: 'profile handle/URL',
      value: profile.linkedin || profile.linkedinId || '',
      public: !!profile.linkedinPublic,
      onValue: (v) => { profile.linkedin = v; profile.linkedinId = v; },
      onPublic: (on) => { profile.linkedinPublic = on; },
    }));
    connectGrid.appendChild(row({
      label: 'ORCID', placeholder: '0000-0000-0000-0000',
      value: profile.orcid || profile.orcidId || '',
      public: !!profile.orcidPublic,
      onValue: (v) => { profile.orcid = v; profile.orcidId = v; },
      onPublic: (on) => { profile.orcidPublic = on; },
    }));
    connectGrid.appendChild(row({
      label: 'Website', type: 'url', placeholder: 'https://…',
      value: profile.website?.value || '',
      public: visToBool(profile.website),
      onValue: (v) => {
        profile.website = { value: v, visibility: profile.website?.visibility || VISIBILITY.PRIVATE };
      },
      onPublic: (on) => {
        profile.website = { value: profile.website?.value || '', visibility: boolToVis(on) };
      },
    }));
  }
  renderIdentity();

  // ---------- account: footer (role · joined · auth email) ----------
  const roleEl = document.getElementById('pfRoleBadge');
  const joinedEl = document.getElementById('pfJoined');
  const authEmailEl = document.getElementById('pfAuthEmail');
  if (roleEl) roleEl.textContent = (profile.role || 'student').replace(/^./, (c) => c.toUpperCase());
  if (joinedEl && profile.joinedAt) {
    joinedEl.textContent = new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  if (authEmailEl) authEmailEl.textContent = user?.email || '—';

  // ---------- secret: type "boom" anywhere ----------
  let buf = '';
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('[contenteditable], input, textarea')) return;
    buf = (buf + e.key).slice(-4).toLowerCase();
    if (buf === 'boom') {
      showToast('boom');
      buf = '';
    }
  });

})();
