// Periodic Table — full lesson page (/periodic-table.html). Loads
// the bundled 119-element dataset (Bowserinator/Periodic-Table-JSON,
// CC0), renders the 18-col grid with category-coloured cells,
// recolours by category / state / block / electronegativity / year,
// supports search, click-for-dossier with an animated Bohr model,
// and 12 challenges spanning recognition, location, and properties.

import './observability.js';
import { requireAuth, signOut } from './auth.js';
import { setUser, breadcrumb } from './observability.js';
import { mountNavbar } from './Navbar.js';

const root = document.documentElement;
root.classList.add('app-auth-pending');
const user = await requireAuth();
setUser(user);
breadcrumb('periodic_table_loaded', { uid: user?.uid ?? null });
root.classList.remove('app-auth-pending');

await mountNavbar({
  user,
  currentModule: { id: 'periodic-table', label: 'Periodic Table' },
  onSignOut: () => signOut(),
});

(async function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Load dataset (~280 KB) bundled at /data/chemistry/elements.json.
  const data = await fetch('/data/chemistry/elements.json').then((r) => r.json());
  const ELEMENTS = data.elements;
  const BY_NUM = new Map(ELEMENTS.map((e) => [e.number, e]));
  const BY_SYM = new Map(ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]));

  // ============================================================
  // STATE
  // ============================================================
  let mode = 'category';   // 'category' | 'phase' | 'block' | 'electroneg' | 'discovered'
  let searchQuery = '';
  let activeFilter = null; // { kind, value } for challenge filters
  let challengeIdx = 0;
  let modalNum = null;

  // ============================================================
  // GRID — 9 rows × 18 cols. Rows 1–7 are main, row 8 spacer, rows
  // 9–10 are lanthanides + actinides moved out beneath the table.
  // The dataset has wxpos / wypos that already gives this layout.
  // ============================================================
  const COLS = 18;
  const ROWS = 10; // 7 main + 1 gap + 2 inner-transition

  function renderGrid() {
    const grid = $('#ptGrid');
    grid.style.gridTemplateRows = `repeat(${ROWS}, minmax(48px, 1fr))`;
    // Standard separated layout — xpos/ypos puts lanthanides at row 9
    // and actinides at row 10. The dataset's wxpos/wypos uses the
    // 32-col WIDE layout which doesn't fit our 18-col grid.
    const cells = new Array(ROWS * COLS).fill(null);
    ELEMENTS.forEach((el) => {
      const x = el.xpos - 1;
      const y = el.ypos - 1;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      cells[y * COLS + x] = el;
    });
    grid.innerHTML = '';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const el = cells[y * COLS + x];
        if (!el) continue;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pt-cell';
        cell.dataset.num = String(el.number);
        cell.dataset.cat = el.category || 'unknown';
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        const massStr = (el.atomic_mass != null) ? formatMass(el.atomic_mass) : '';
        cell.innerHTML = `
          <span class="num">${el.number}</span>
          <span class="sym">${el.symbol}</span>
          <span class="name">${el.name}</span>
          <span class="mass">${massStr}</span>
        `;
        cell.addEventListener('click', () => openModal(el.number));
        cell.addEventListener('mouseenter', () => prefetchModal(el.number));
        grid.appendChild(cell);
      }
    }
    // Two indicator cells in the main table at row 6 / row 7, col 3.
    // The dataset leaves these slots empty (because lanthanides and
    // actinides got moved out), so we paint a "57–71" / "89–103"
    // pointer that scrolls down to the f-block rows.
    addRangeIndicator(grid, 6, 3, '57–71', 'Lanthanides',  57);
    addRangeIndicator(grid, 7, 3, '89–103', 'Actinides',   89);
    applyMode();
    applySearch();
  }
  function addRangeIndicator(grid, row, col, range, label, jumpTo) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'pt-cell pt-cell-range';
    cell.dataset.cat = label.toLowerCase();
    cell.style.gridColumn = String(col);
    cell.style.gridRow = String(row);
    cell.innerHTML = `
      <span class="num">${range}</span>
      <span class="sym">↓</span>
      <span class="name">${label}</span>
      <span class="mass"></span>
    `;
    cell.addEventListener('click', () => openModal(jumpTo));
    grid.appendChild(cell);
  }
  function formatMass(m) {
    if (m >= 100) return m.toFixed(2);
    if (m >= 10)  return m.toFixed(2);
    return m.toFixed(3);
  }

  // ============================================================
  // MODE — recolours cells by selected property.
  // ============================================================
  function applyMode() {
    const cells = $$('.pt-cell', $('#ptGrid'));
    cells.forEach((cell) => {
      const num = parseInt(cell.dataset.num, 10);
      const el = BY_NUM.get(num);
      if (!el) return;
      // Reset inline backgrounds — category-mode uses the data-cat
      // CSS rules.
      if (mode === 'category') {
        cell.style.background = '';
      } else if (mode === 'phase') {
        cell.style.background = phaseColor(el.phase);
      } else if (mode === 'block') {
        cell.style.background = blockColor(el.block);
      } else if (mode === 'electroneg') {
        cell.style.background = electronegColor(el.electronegativity_pauling);
      } else if (mode === 'discovered') {
        cell.style.background = discoveredColor(el.discovered_by);
      }
    });
    renderLegend();
  }
  function phaseColor(phase) {
    if (phase === 'Solid')  return 'rgba(91, 63, 255, 0.16)';
    if (phase === 'Liquid') return 'rgba(13, 148, 136, 0.20)';
    if (phase === 'Gas')    return 'rgba(255, 184, 0, 0.20)';
    return 'var(--paper-3)';
  }
  function blockColor(block) {
    if (block === 's') return 'rgba(255, 107, 74, 0.18)';
    if (block === 'p') return 'rgba(31, 138, 91, 0.18)';
    if (block === 'd') return 'rgba(91, 63, 255, 0.18)';
    if (block === 'f') return 'rgba(200, 16, 46, 0.18)';
    return 'var(--paper-3)';
  }
  function electronegColor(en) {
    if (en == null) return 'var(--paper-3)';
    // Pauling scale max ~ 4.0 (fluorine), min ~ 0.7 (Cs/Fr)
    const t = Math.max(0, Math.min(1, (en - 0.7) / (4.0 - 0.7)));
    // ink (0,0,255 desat) → acid (red)
    const r = Math.round(80  + (200 - 80)  * t);
    const g = Math.round(120 + (16  - 120) * t);
    const b = Math.round(220 + (46  - 220) * t);
    return `rgba(${r},${g},${b},0.30)`;
  }
  function discoveredColor(discoveredBy) {
    // Crude "year discovered" heuristic — if there's no discoverer
    // listed, show as paper-3. Otherwise warm-paper for ancient
    // (no specific person) → modern blue for synthetic ones.
    if (!discoveredBy) return 'rgba(255, 184, 0, 0.16)'; // ancient / pre-record
    // Heuristic by element number — heavier = more recent.
    return null;
  }

  function renderLegend() {
    const lg = $('#ptLegend');
    if (mode === 'category') {
      const cats = [
        ['alkali metal',         'rgba(255, 107, 74, 0.6)'],
        ['alkaline earth metal', 'rgba(255, 184, 0, 0.6)'],
        ['lanthanide',           'rgba(200, 16, 46, 0.6)'],
        ['actinide',             'rgba(155, 60, 120, 0.6)'],
        ['transition metal',     'rgba(91, 63, 255, 0.5)'],
        ['post-transition metal','rgba(91, 63, 255, 0.3)'],
        ['metalloid',            'rgba(13, 148, 136, 0.6)'],
        ['diatomic nonmetal',    'rgba(31, 138, 91, 0.6)'],
        ['polyatomic nonmetal',  'rgba(31, 138, 91, 0.4)'],
        ['noble gas',            'rgba(91, 63, 255, 0.7)'],
      ];
      lg.innerHTML = `<h3>Category</h3>` +
        cats.map(([n, c]) => `
          <div class="row" data-filter-cat="${n}">
            <span class="swatch" style="background:${c}"></span>
            <span class="lbl">${n}</span>
          </div>
        `).join('');
    } else if (mode === 'phase') {
      lg.innerHTML = `<h3>State at 0 °C</h3>
        <div class="row"><span class="swatch" style="background:rgba(91, 63, 255, 0.5)"></span><span class="lbl">solid</span></div>
        <div class="row"><span class="swatch" style="background:rgba(13, 148, 136, 0.7)"></span><span class="lbl">liquid</span></div>
        <div class="row"><span class="swatch" style="background:rgba(255, 184, 0, 0.7)"></span><span class="lbl">gas</span></div>
      `;
    } else if (mode === 'block') {
      lg.innerHTML = `<h3>Block</h3>
        <div class="row"><span class="swatch" style="background:rgba(255, 107, 74, 0.6)"></span><span class="lbl">s — alkali, alkaline-earth, H, He</span></div>
        <div class="row"><span class="swatch" style="background:rgba(31, 138, 91, 0.6)"></span><span class="lbl">p — main-group right of d-block</span></div>
        <div class="row"><span class="swatch" style="background:rgba(91, 63, 255, 0.6)"></span><span class="lbl">d — transition metals</span></div>
        <div class="row"><span class="swatch" style="background:rgba(200, 16, 46, 0.6)"></span><span class="lbl">f — lanthanides + actinides</span></div>
      `;
    } else if (mode === 'electroneg') {
      lg.innerHTML = `<h3>Electronegativity (Pauling)</h3>
        <div class="gradient" style="background: linear-gradient(90deg, rgba(80,120,220,1), rgba(200,16,46,1));"></div>
        <div class="gradient-labs"><span>0.7 (Cs)</span><span>4.0 (F)</span></div>
        <div class="row" style="grid-template-columns: 1fr;"><span class="lbl">Higher = pulls electrons harder when bonded.</span></div>
      `;
    } else if (mode === 'discovered') {
      lg.innerHTML = `<h3>Origin</h3>
        <div class="row"><span class="swatch" style="background:rgba(255, 184, 0, 0.5)"></span><span class="lbl">Known since antiquity</span></div>
        <div class="row" style="grid-template-columns: 1fr;"><span class="lbl">Most heavy elements (Z > 92) are entirely synthetic — first produced in particle accelerators.</span></div>
      `;
    }
    // Wire category-row click-to-filter.
    $$('.row[data-filter-cat]', lg).forEach((row) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const cat = row.dataset.filterCat;
        if (activeFilter && activeFilter.value === cat) activeFilter = null;
        else activeFilter = { kind: 'category', value: cat };
        applySearch();
      });
    });
  }

  // ============================================================
  // SEARCH + FILTER
  // ============================================================
  function applySearch() {
    const q = searchQuery.trim().toLowerCase();
    $$('.pt-cell', $('#ptGrid')).forEach((cell) => {
      const num = parseInt(cell.dataset.num, 10);
      const el = BY_NUM.get(num);
      if (!el) return;
      let match = true;
      if (q) {
        match = el.name.toLowerCase().includes(q) ||
                el.symbol.toLowerCase() === q ||
                el.symbol.toLowerCase().startsWith(q) ||
                String(el.number) === q;
      }
      if (activeFilter && activeFilter.kind === 'category') {
        match = match && (el.category || '').toLowerCase() === activeFilter.value.toLowerCase();
      }
      cell.classList.toggle('is-dim', !match && (q || activeFilter));
      cell.classList.toggle('is-match', match && (q || activeFilter));
    });
  }
  $('#ptSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applySearch();
  });

  $$('.pt-mode .seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.pt-mode .seg button').forEach((x) => x.classList.remove('is-on'));
      btn.classList.add('is-on');
      mode = btn.dataset.v;
      applyMode();
    });
  });

  // ============================================================
  // MODAL — element dossier
  // ============================================================
  function prefetchModal(num) { /* no-op for now; could prefetch images */ }
  function openModal(num) {
    const el = BY_NUM.get(num);
    if (!el) return;
    modalNum = num;
    $('#modalNum').textContent = String(el.number);
    $('#modalSymbol').textContent = el.symbol;
    $('#modalName').textContent = el.name;
    $('#modalTag').textContent = `${el.category} · ${el.phase || 'unknown'} · ${el.atomic_mass != null ? el.atomic_mass.toFixed(3) + ' u' : '—'}`;
    $('#modalConfig').textContent = el.electron_configuration_semantic || el.electron_configuration || '—';
    renderBohr(el);
    renderModalStats(el);
    $('#modalSummary').textContent = el.summary || '—';
    const disco = el.discovered_by ? `Discovered by ${el.discovered_by}` : 'Known since antiquity';
    const named = el.named_by ? ` · named by ${el.named_by}` : '';
    $('#modalDiscovered').textContent = disco + named;
    $('#elementModal').hidden = false;
    document.body.style.overflow = 'hidden';
    updateChallengeStatus(el);
  }
  function closeModal() {
    $('#elementModal').hidden = true;
    document.body.style.overflow = '';
    modalNum = null;
  }
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (!$('#elementModal').hidden) {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowRight') openModal(Math.min(118, modalNum + 1));
      else if (e.key === 'ArrowLeft')  openModal(Math.max(1, modalNum - 1));
    }
  });
  $('#modalNext').addEventListener('click', () => modalNum != null && openModal(Math.min(118, modalNum + 1)));
  $('#modalPrev').addEventListener('click', () => modalNum != null && openModal(Math.max(1, modalNum - 1)));

  function renderModalStats(el) {
    const grid = $('#modalStats');
    const rows = [
      ['Atomic mass',      el.atomic_mass != null ? `${el.atomic_mass.toFixed(4)} u` : '—'],
      ['Period · Group',   `${el.period} · ${el.group ?? '—'}`],
      ['Block',            (el.block || '—').toUpperCase()],
      ['Phase (0 °C)',     el.phase || '—'],
      ['Density',          el.density != null ? `${el.density} g/cm³` : '—'],
      ['Melting point',    el.melt != null ? `${el.melt.toFixed(1)} K` : '—'],
      ['Boiling point',    el.boil != null ? `${el.boil.toFixed(1)} K` : '—'],
      ['Electronegativity',el.electronegativity_pauling != null ? el.electronegativity_pauling.toFixed(2) : '—'],
      ['Electron affinity',el.electron_affinity != null ? `${el.electron_affinity} kJ/mol` : '—'],
      ['1st ionization',   (el.ionization_energies && el.ionization_energies[0]) != null ? `${el.ionization_energies[0]} kJ/mol` : '—'],
    ];
    grid.innerHTML = rows.map(([k, v]) => `
      <div class="stat">
        <span class="lab">${k}</span>
        <span class="val">${v}</span>
      </div>
    `).join('');
  }

  // ============================================================
  // BOHR MODEL — concentric shells with orbiting electrons.
  // Uses CSS animation via setTimeout RAF so we don't keep an
  // animation loop running when modal is closed.
  // ============================================================
  let bohrAnim = null;
  function renderBohr(el) {
    const svg = $('#modalBohr');
    const W = 320, H = 320;
    const cx = W / 2, cy = H / 2;
    const shells = el.shells || [];
    const shellCount = shells.length;
    const maxR = Math.min(W, H) / 2 - 14;
    const innerR = 22;
    // Render shell rings + electron placeholders.
    let parts = '';
    parts += `<circle class="nucleus" cx="${cx}" cy="${cy}" r="${innerR}"/>`;
    parts += `<text class="symbol-label" x="${cx}" y="${cy + 5}">${el.symbol}</text>`;
    const radii = [];
    shells.forEach((count, i) => {
      const r = innerR + 18 + (maxR - innerR - 18) * ((i + 1) / Math.max(1, shellCount));
      radii.push(r);
      parts += `<circle class="shell" cx="${cx}" cy="${cy}" r="${r}"/>`;
      // Electrons rendered via <g class="electron-shell"> animated in JS
      parts += `<g class="electron-shell" data-shell="${i}" data-r="${r}" data-count="${count}"></g>`;
    });
    svg.innerHTML = parts;

    // Animate electrons rotating around their shell.
    if (bohrAnim) cancelAnimationFrame(bohrAnim);
    let t0 = performance.now();
    function step(t) {
      const dt = (t - t0) / 1000;
      shells.forEach((count, shellIdx) => {
        const g = svg.querySelector(`.electron-shell[data-shell="${shellIdx}"]`);
        if (!g) return;
        const r = parseFloat(g.dataset.r);
        // Rotation rate inversely proportional to shell number (outer
        // shells slower, like classical atomic models).
        const omega = 0.6 / (shellIdx + 1);
        const phase = (shellIdx * Math.PI) / shellCount;
        let inner = '';
        for (let i = 0; i < count; i++) {
          const a = phase + dt * omega + (i * 2 * Math.PI) / count;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          inner += `<circle class="electron" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.5"/>`;
        }
        g.innerHTML = inner;
      });
      bohrAnim = requestAnimationFrame(step);
    }
    bohrAnim = requestAnimationFrame(step);
  }

  // ============================================================
  // CHALLENGES
  // ============================================================
  const CHALLENGES = [
    { label: 'Click a noble gas',           meta: 'GROUP', kind: 'cat',  target: 'noble gas',
      prompt: 'Click any <em>noble gas</em> — they sit on the right edge of the table.' },
    { label: 'Click an alkali metal',       meta: 'GROUP', kind: 'cat',  target: 'alkali metal',
      prompt: 'Click any <em>alkali metal</em>. Hint: they\'re the leftmost column (excluding hydrogen).' },
    { label: 'Click a halogen',             meta: 'GROUP', kind: 'cat',  target: 'diatomic nonmetal', filter: (el) => [9, 17, 35, 53, 85].includes(el.number),
      prompt: 'Click any <em>halogen</em> (group 17 — F, Cl, Br, I, At).' },
    { label: 'Find atomic number 79',       meta: 'NUM',   kind: 'num',  target: 79,
      prompt: 'Find the element with <em>atomic number 79</em>. (Hint: the element behind every wedding ring.)' },
    { label: 'Find Carbon',                 meta: 'NAME',  kind: 'name', target: 'C',
      prompt: 'Click on <em>Carbon</em>.' },
    { label: 'Most electronegative',        meta: 'PROP',  kind: 'num',  target: 9,
      prompt: 'Click on the <em>most electronegative</em> element on the table. (Pauling 4.0.)' },
    { label: 'A metalloid',                 meta: 'GROUP', kind: 'cat',  target: 'metalloid',
      prompt: 'Click any <em>metalloid</em> — the staircase between metals and nonmetals.' },
    { label: 'A liquid at 25 °C',           meta: 'STATE', kind: 'phase', target: 'Liquid', extraOk: (el) => [35, 80].includes(el.number),
      prompt: 'Click an element that is <em>liquid</em> at room temperature. Only two qualify.' },
    { label: 'A lanthanide',                meta: 'F-BLK', kind: 'cat',  target: 'lanthanide',
      prompt: 'Click any <em>lanthanide</em> — the f-block row underneath the main table.' },
    { label: 'An actinide',                 meta: 'F-BLK', kind: 'cat',  target: 'actinide',
      prompt: 'Click any <em>actinide</em>. The bottom f-block row.' },
    { label: 'A semiconductor anchor',      meta: 'USE',   kind: 'num',  target: 14,
      prompt: 'Click <em>silicon</em>, the element behind every microchip.' },
    { label: 'Tour: Z=1, then Z=92',        meta: 'TOUR',  kind: 'tour', targets: [1, 92], cursor: 0,
      prompt: 'Tour: open <em>Hydrogen</em> first, then <em>Uranium</em>. Click Next ›  in the modal once Hydrogen is open.' },
  ];

  function refreshChallengeUI() {
    const ch = CHALLENGES[challengeIdx];
    const tag = $('#chalTag');
    if (tag) {
      const n = String(challengeIdx + 1).padStart(2, '0');
      const m = String(CHALLENGES.length).padStart(2, '0');
      tag.textContent = `Challenge ${n} / ${m}`;
    }
    $('#chalPrompt').innerHTML = ch.prompt;
    const lbl = $('#chalPickLabel');
    if (lbl) lbl.textContent = `${String(challengeIdx + 1).padStart(2, '0')} · ${ch.label}`;
    $$('#chalPickList li').forEach((el) => {
      el.setAttribute('aria-selected', el.dataset.idx === String(challengeIdx) ? 'true' : 'false');
    });
    if (ch.kind === 'tour') ch.cursor = 0;
    $('#chal').classList.remove('is-solved');
    $('#chal .status .lab').textContent = 'Try it';
  }
  function updateChallengeStatus(clickedEl) {
    if (!clickedEl) return;
    const ch = CHALLENGES[challengeIdx];
    let ok = false;
    if (ch.kind === 'cat') {
      ok = (clickedEl.category || '').toLowerCase() === ch.target.toLowerCase();
      if (ok && ch.filter) ok = ch.filter(clickedEl);
    } else if (ch.kind === 'num') {
      ok = clickedEl.number === ch.target;
    } else if (ch.kind === 'name') {
      ok = clickedEl.symbol === ch.target;
    } else if (ch.kind === 'phase') {
      ok = clickedEl.phase === ch.target || (ch.extraOk && ch.extraOk(clickedEl));
    } else if (ch.kind === 'tour') {
      if (clickedEl.number === ch.targets[ch.cursor]) {
        ch.cursor += 1;
        if (ch.cursor >= ch.targets.length) ok = true;
      }
    }
    const chal = $('#chal');
    chal.classList.toggle('is-solved', ok);
    chal.querySelector('.status .lab').textContent = ok ? 'Solved' : 'Try it';
    if (ok) setTimeout(() => {
      if (chal.classList.contains('is-solved')) applyChallenge(challengeIdx + 1);
    }, 1100);
  }
  function applyChallenge(idx) {
    challengeIdx = ((idx % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
    refreshChallengeUI();
  }
  function renderChallengePicker() {
    const list = $('#chalPickList');
    if (!list) return;
    list.innerHTML = CHALLENGES.map((c, i) => {
      const num = String(i + 1).padStart(2, '0');
      return `<li role="option" data-idx="${i}" tabindex="-1"
        aria-selected="${i === challengeIdx ? 'true' : 'false'}">
        <span class="num">${num}</span>
        <span class="lbl">${c.label}</span>
        <span class="meta">${c.meta}</span>
      </li>`;
    }).join('');
  }
  let chalOpen = false;
  function positionChalPop() {
    const btn = $('#chalPickBtn'); const list = $('#chalPickList');
    if (!btn || !list) return;
    const r = btn.getBoundingClientRect();
    list.style.top = `${r.bottom + 6}px`;
    list.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    list.style.left = 'auto';
    list.style.maxHeight = `${Math.max(160, window.innerHeight - r.bottom - 24)}px`;
  }
  function openChalPicker() {
    if (chalOpen) return;
    const list = $('#chalPickList'); const btn = $('#chalPickBtn');
    if (!list || !btn) return;
    list.hidden = false; btn.setAttribute('aria-expanded', 'true'); chalOpen = true;
    positionChalPop();
    window.addEventListener('scroll', positionChalPop, true);
    window.addEventListener('resize', positionChalPop);
    const sel = list.querySelector('[aria-selected="true"]') || list.firstElementChild;
    sel?.focus();
  }
  function closeChalPicker() {
    if (!chalOpen) return;
    const list = $('#chalPickList'); const btn = $('#chalPickBtn');
    if (list) list.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false');
    chalOpen = false;
    window.removeEventListener('scroll', positionChalPop, true);
    window.removeEventListener('resize', positionChalPop);
  }
  $('#chalPickBtn')?.addEventListener('click', (e) => {
    e.stopPropagation(); chalOpen ? closeChalPicker() : openChalPicker();
  });
  $('#chalPickList')?.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    closeChalPicker(); applyChallenge(parseInt(li.dataset.idx, 10));
    $('#chalPickBtn')?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!chalOpen) return;
    if (e.target.closest('.pt-chal-pick-wrap')) return;
    closeChalPicker();
  });
  $('#chalSkip')?.addEventListener('click', () => applyChallenge(challengeIdx + 1));

  // ============================================================
  // BOOT
  // ============================================================
  renderGrid();
  renderChallengePicker();
  refreshChallengeUI();
})();
