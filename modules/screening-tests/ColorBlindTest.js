/**
 * Ishihara-style screening using plates in data/colorblind/ (WebP).
 * Persists summary to SkillGraph profile under colorVision.
 *
 * Behaviour:
 *   - 12 plate cards rendered in a grid; user types the digit they see
 *     (or checks "nothing visible" if the plate looks like noise to them).
 *   - Each plate is graded LIVE — a ✓ or ✗ appears next to the plate
 *     number as soon as the user fills the field.
 *   - Once all 12 plates are answered, the full report auto-renders and
 *     scrolls into view. There is NO submit button.
 *   - The answer key is hidden — the test would be meaningless if shown.
 *   - All visuals come from knowsy.css design tokens (paper / ink / acid /
 *     serif / mono); no inline `<style>` block.
 */

import ProfileManager from '../../src/ProfileManager.js';

// Vite's `import.meta.url` rewriting strips trailing slashes from relative
// asset URLs, which broke `new URL(filename, BASE)` resolution. Hardcoding
// the absolute path is portable across dev, build, and raw-served modes.
const COLORBLIND_BASE_PATH = '/data/colorblind/';

const StorageManager = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* ignore */
        }
    },
};

/** Digits only; strip leading zeros so "012" / "08" match "12" / "8". */
function normalizeAnswer(s) {
    if (s == null) return '';
    const d = String(s).replace(/\D/g, '');
    if (!d) return '';
    const trimmed = d.replace(/^0+/, '');
    return trimmed === '' ? '0' : trimmed;
}

function plateImageUrl(filename) {
    return COLORBLIND_BASE_PATH + filename;
}

/** Verified normals; plates 1–12 map to colorblind-test-image1…12.webp */
const PLATES = [
    { key: 'p1', file: 'colorblind-test-image1.webp', title: 'Plate 1', interpret: { normal: ['7'] } },
    { key: 'p2', file: 'colorblind-test-image2.webp', title: 'Plate 2', interpret: { normal: ['6'] } },
    { key: 'p3', file: 'colorblind-test-image3.webp', title: 'Plate 3', interpret: { normal: ['26'] } },
    { key: 'p4', file: 'colorblind-test-image4.webp', title: 'Plate 4', interpret: { normal: ['15'] } },
    { key: 'p5', file: 'colorblind-test-image5.webp', title: 'Plate 5', interpret: { normal: ['6'] } },
    { key: 'p6', file: 'colorblind-test-image6.webp', title: 'Plate 6', interpret: { normal: ['73'] } },
    { key: 'p7', file: 'colorblind-test-image7.webp', title: 'Plate 7', interpret: { normal: ['5'] } },
    { key: 'p8', file: 'colorblind-test-image8.webp', title: 'Plate 8', interpret: { normal: ['16'] } },
    { key: 'p9', file: 'colorblind-test-image9.webp', title: 'Plate 9', interpret: { normal: ['45'] } },
    { key: 'p10', file: 'colorblind-test-image10.webp', title: 'Plate 10', interpret: { normal: ['12'] } },
    { key: 'p11', file: 'colorblind-test-image11.webp', title: 'Plate 11', interpret: { normal: ['29'] } },
    { key: 'p12', file: 'colorblind-test-image12.webp', title: 'Plate 12', interpret: { normal: ['8'] } },
];

function expectedDigit(plate) {
    return plate.interpret?.normal?.[0] ?? '?';
}

function expectedDigits(plate) {
    const vals = plate.interpret?.normal ?? [];
    return vals.map((v) => normalizeAnswer(v)).filter(Boolean);
}

function isCorrectAnswer(plate, value) {
    const given = normalizeAnswer(value);
    if (!given) return false;
    return expectedDigits(plate).includes(given);
}

function classifyAnswers(answers) {
    const platesTotal = PLATES.length;
    let matched = 0;
    for (const plate of PLATES) {
        if (isCorrectAnswer(plate, answers[plate.key])) matched++;
    }

    if (matched === platesTotal) {
        return {
            classification: 'normal_color_vision',
            platesTotal,
            platesMatchedNormal: matched,
            platesMatchedRgPattern: 0,
            platesMatchedTritanPattern: 0,
            summaryLine: `All ${platesTotal} plates match — color vision looks typical.`,
            detailHtml:
                '<p>You read every plate the standard way. Most charts, code highlights, and circuit diagrams will render the way the designer intended.</p>',
        };
    }
    if (matched <= Math.floor(platesTotal / 2)) {
        return {
            classification: 'possible_red_green_deficiency',
            platesTotal,
            platesMatchedNormal: matched,
            platesMatchedRgPattern: platesTotal - matched,
            platesMatchedTritanPattern: 0,
            summaryLine: `${matched}/${platesTotal} plates match — pattern consistent with a red-green color vision difference.`,
            detailHtml:
                '<p>Several plates didn\'t match the standard answer. That can mean nothing more than tired eyes or a poorly-lit screen — or it can indicate a red-green color difference, which is common (~8% of men, ~0.5% of women).</p>' +
                '<p>Knowsy will lean on shape, position, and labels in addition to color from now on.</p>',
        };
    }
    return {
        classification: 'mixed_results',
        platesTotal,
        platesMatchedNormal: matched,
        platesMatchedRgPattern: 0,
        platesMatchedTritanPattern: 0,
        summaryLine: `${matched}/${platesTotal} plates match — mixed results.`,
        detailHtml:
            '<p>Check typos, room lighting, and your monitor\'s color profile. You can re-take the test from any widget.</p>',
    };
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class ColorBlindTest {
    constructor(mountId) {
        const panel = document.getElementById(mountId);
        if (!panel) return;

        const uid = `${mountId}-cb`;
        const state = Object.create(null);
        for (const plate of PLATES) {
            state[plate.key] = { value: '', none: false, status: 'empty' };
        }

        panel.innerHTML = `
<div class="cb-test">
  <header class="cb-test__intro">
    <div class="cb-test__eyebrow">— Color vision check</div>
    <h2 class="cb-test__title">Twelve plates. <em>Type what you see.</em></h2>
    <p class="cb-test__lead">
      If a plate just looks like noise to you, check <strong>nothing visible</strong> and move on.
      Each answer is graded the moment you fill it in — your full report appears once all twelve are answered.
      Not a medical diagnosis.
    </p>
    <div class="cb-test__progress" aria-live="polite">
      <span class="cb-test__progress-bar"><span class="cb-test__progress-fill" id="${uid}-fill"></span></span>
      <span class="cb-test__progress-text"><span id="${uid}-completed">0</span> / ${PLATES.length} answered</span>
    </div>
  </header>

  <div class="cb-test__grid" id="${uid}-grid"></div>

  <section class="cb-test__report" id="${uid}-report" hidden aria-live="polite"></section>
</div>`;

        const grid = panel.querySelector(`#${uid}-grid`);
        PLATES.forEach((plate, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const card = document.createElement('section');
            card.className = 'cb-test__plate';
            card.innerHTML = `
              <div class="cb-test__plate-head">
                <span class="cb-test__plate-num">/ ${num}</span>
                <span class="cb-test__plate-status" id="${uid}-${plate.key}-status" data-status="empty" aria-label="Plate ${idx + 1} status">—</span>
              </div>
              <img class="cb-test__plate-img" src="${plateImageUrl(plate.file)}" alt="" loading="lazy" decoding="async" />
              <div class="cb-test__plate-field">
                <input type="text" inputmode="numeric" autocomplete="off" placeholder="digits"
                       id="${uid}-${plate.key}-in" aria-label="Digits for plate ${idx + 1}" />
                <label class="cb-test__none-label">
                  <input type="checkbox" id="${uid}-${plate.key}-none" />
                  <span>nothing visible</span>
                </label>
              </div>
            `;
            grid.appendChild(card);

            const input = card.querySelector(`#${uid}-${plate.key}-in`);
            const none = card.querySelector(`#${uid}-${plate.key}-none`);

            input.addEventListener('input', () => {
                state[plate.key].value = input.value;
                if (input.value && none.checked) {
                    none.checked = false;
                    state[plate.key].none = false;
                }
                updatePlateStatus(plate);
                refreshProgress();
            });
            none.addEventListener('change', () => {
                state[plate.key].none = none.checked;
                if (none.checked) {
                    input.value = '';
                    state[plate.key].value = '';
                }
                input.disabled = none.checked;
                updatePlateStatus(plate);
                refreshProgress();
            });
        });

        function updatePlateStatus(plate) {
            const s = state[plate.key];
            const el = panel.querySelector(`#${uid}-${plate.key}-status`);
            if (!el) return;
            if (s.none) {
                s.status = 'wrong'; // every plate has a digit; "nothing" = wrong
                el.dataset.status = 'wrong';
                el.textContent = '✗';
                el.title = 'No digit reported.';
                return;
            }
            const actual = normalizeAnswer(s.value);
            if (!actual) {
                s.status = 'empty';
                el.dataset.status = 'empty';
                el.textContent = '—';
                el.title = '';
                return;
            }
            if (isCorrectAnswer(plate, s.value)) {
                s.status = 'correct';
                el.dataset.status = 'correct';
                el.textContent = '✓';
                el.title = 'Correct.';
            } else {
                s.status = 'wrong';
                el.dataset.status = 'wrong';
                el.textContent = '✗';
                el.title = 'Doesn\'t match the standard answer.';
            }
        }

        function refreshProgress() {
            const completed = Object.values(state).filter((s) => s.status !== 'empty').length;
            const completedEl = panel.querySelector(`#${uid}-completed`);
            const fillEl = panel.querySelector(`#${uid}-fill`);
            if (completedEl) completedEl.textContent = String(completed);
            if (fillEl) fillEl.style.width = `${(completed / PLATES.length) * 100}%`;

            if (completed === PLATES.length) {
                renderReport();
            } else {
                const report = panel.querySelector(`#${uid}-report`);
                if (report) report.hidden = true;
            }
        }

        function renderReport() {
            const answers = {};
            for (const plate of PLATES) {
                answers[plate.key] = state[plate.key].none ? '' : state[plate.key].value;
            }
            const outcome = classifyAnswers(answers);

            // Persist to profile.
            const profile = ProfileManager.load(StorageManager);
            const next = ProfileManager.normalize({
                ...profile,
                colorVision: {
                    ...profile.colorVision,
                    lastScreeningAt: new Date().toISOString(),
                    classification: outcome.classification,
                    platesTotal: outcome.platesTotal,
                    platesMatchedNormal: outcome.platesMatchedNormal,
                    platesMatchedRgPattern: outcome.platesMatchedRgPattern,
                    platesMatchedTritanPattern: outcome.platesMatchedTritanPattern,
                    summaryLine: outcome.summaryLine,
                    answers,
                },
            });
            ProfileManager.save(StorageManager, next);

            const report = panel.querySelector(`#${uid}-report`);
            if (!report) return;

            const rows = PLATES.map((plate, idx) => {
                const s = state[plate.key];
                const expected = expectedDigits(plate).join(' / ') || expectedDigit(plate);
                const yourAnswer = s.none ? 'nothing' : s.value || '—';
                const correct = !s.none && isCorrectAnswer(plate, s.value);
                return `
                  <tr>
                    <td class="cb-test__report-plate">${idx + 1}</td>
                    <td class="cb-test__report-correct">${escapeHtml(expected)}</td>
                    <td class="cb-test__report-yours">${escapeHtml(yourAnswer)}</td>
                    <td class="cb-test__report-mark" data-correct="${correct}">${correct ? '✓' : '✗'}</td>
                  </tr>
                `;
            }).join('');

            report.hidden = false;
            report.innerHTML = `
              <div class="cb-test__report-eyebrow">— Results</div>
              <h2 class="cb-test__report-title">You got <em>${outcome.platesMatchedNormal} of ${outcome.platesTotal}.</em></h2>
              <p class="cb-test__report-summary">${escapeHtml(outcome.summaryLine)}</p>
              <div class="cb-test__report-detail">${outcome.detailHtml}</div>
              <table class="cb-test__report-table">
                <thead>
                  <tr><th>Plate</th><th>Standard</th><th>You said</th><th aria-label="match"></th></tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <div class="cb-test__report-actions">
                <button type="button" class="btn btn-ghost" id="${uid}-retry">Take it again</button>
              </div>
              <p class="cb-test__report-foot">
                Saved to your profile · category <code>${escapeHtml(outcome.classification)}</code>.
                Not a medical diagnosis — for clinical screening, see an optometrist.
              </p>
            `;

            panel.querySelector(`#${uid}-retry`)?.addEventListener('click', () => {
                for (const plate of PLATES) {
                    const inp = panel.querySelector(`#${uid}-${plate.key}-in`);
                    const none = panel.querySelector(`#${uid}-${plate.key}-none`);
                    if (inp) {
                        inp.value = '';
                        inp.disabled = false;
                    }
                    if (none) none.checked = false;
                    state[plate.key] = { value: '', none: false, status: 'empty' };
                    updatePlateStatus(plate);
                }
                refreshProgress();
                panel.querySelector(`.cb-test__intro`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            report.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Pre-fill from any previously-saved answers so users see their last
        // attempt rather than a blank slate. They can edit and re-grade.
        const stored = ProfileManager.load(StorageManager);
        const cv = stored.colorVision;
        if (cv?.classification && cv.classification !== 'not_assessed' && cv.answers) {
            for (const plate of PLATES) {
                const saved = cv.answers[plate.key];
                if (saved === undefined) continue;
                const inp = panel.querySelector(`#${uid}-${plate.key}-in`);
                const none = panel.querySelector(`#${uid}-${plate.key}-none`);
                if (saved === '') {
                    if (none) none.checked = true;
                    if (inp) inp.disabled = true;
                    state[plate.key].none = true;
                } else {
                    if (inp) inp.value = saved;
                    state[plate.key].value = saved;
                }
                updatePlateStatus(plate);
            }
            refreshProgress();
        }
    }
}
