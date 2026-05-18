// Health probe — kept deliberately tiny. The uptime workflow grep's the
// sentinel string KNOWSY_HEALTH_OK out of the rendered HTML, and only
// considers the site "green" if the page renders cleanly to that
// state (200 + JS executed + DOM patched).
//
// Don't import auth, firebase, or anything that requires env vars —
// health must work even when the .env hasn't been wired yet, otherwise
// the uptime probe will scream during deploy windows.

const SENTINEL = 'KNOWSY_HEALTH_OK';

function render(state, detail) {
  const el = document.getElementById('probe');
  if (!el) return;
  const lines = [
    `state:    ${state}`,
    `version:  ${import.meta.env?.VITE_APP_VERSION ?? 'dev'}`,
    `env:      ${import.meta.env?.VITE_ENVIRONMENT ?? 'local'}`,
    `checked:  ${new Date().toISOString()}`,
  ];
  if (detail) lines.push(`detail:   ${detail}`);
  if (state === 'ok') lines.push('', SENTINEL);
  el.textContent = lines.join('\n');
}

try {
  render('ok');
} catch (e) {
  render('error', e?.message ?? String(e));
}
