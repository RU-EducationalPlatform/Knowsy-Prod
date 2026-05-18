import { escapeHtml } from './html.js';

/**
 * Subtle in-page error toast for window.onerror and unhandledrejection.
 * Stays out of DevTools — students paste the "Copy details" text into Slack/email.
 *
 * Themed via .app-error-overlay-* classes in textbook.css.
 */

const MAX_QUEUED = 5;

let host = null;
let queue = [];

function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.className = 'app-error-overlay';
    host.setAttribute('role', 'log');
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(host);
    return host;
}

function formatDetails(entry) {
    const lines = [];
    lines.push(`message: ${entry.message}`);
    if (entry.source) lines.push(`source:  ${entry.source}`);
    if (entry.location) lines.push(`at:      ${entry.location}`);
    if (entry.stack) {
        lines.push('stack:');
        lines.push(entry.stack);
    }
    lines.push(`time:    ${new Date(entry.ts).toISOString()}`);
    lines.push(`page:    ${location.pathname}${location.hash}`);
    lines.push(`agent:   ${navigator.userAgent}`);
    return lines.join('\n');
}

function pushCard(entry) {
    const root = ensureHost();
    while (root.children.length >= MAX_QUEUED) {
        root.firstElementChild.remove();
    }

    const card = document.createElement('div');
    card.className = 'app-error-overlay-card';
    card.innerHTML = `
        <div class="app-error-overlay-head">
            <span class="app-error-overlay-source">${escapeHtml(entry.source ?? 'error')}</span>
            <button type="button" class="app-error-overlay-copy" title="Copy details">Copy</button>
            <button type="button" class="app-error-overlay-close" aria-label="Dismiss">×</button>
        </div>
        <div class="app-error-overlay-msg"></div>
        <div class="app-error-overlay-loc"></div>
    `;
    card.querySelector('.app-error-overlay-msg').textContent = entry.message;
    if (entry.location) {
        card.querySelector('.app-error-overlay-loc').textContent = entry.location;
    }

    card.querySelector('.app-error-overlay-copy').addEventListener('click', async () => {
        const details = formatDetails(entry);
        try {
            await navigator.clipboard.writeText(details);
            card.querySelector('.app-error-overlay-copy').textContent = 'Copied';
            setTimeout(() => {
                const btn = card.querySelector('.app-error-overlay-copy');
                if (btn) btn.textContent = 'Copy';
            }, 1500);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = details;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    });
    card.querySelector('.app-error-overlay-close').addEventListener('click', () => {
        card.classList.add('app-error-overlay-card--leaving');
        setTimeout(() => card.remove(), 180);
    });

    root.appendChild(card);
    requestAnimationFrame(() => card.classList.add('app-error-overlay-card--in'));
}

function reportError(entry) {
    queue.push(entry);
    if (queue.length > 50) queue = queue.slice(-50);
    pushCard(entry);
}

/** Wire to window.onerror + unhandledrejection. Idempotent. */
export function installErrorOverlay() {
    if (window.__appErrorOverlayInstalled) return;
    window.__appErrorOverlayInstalled = true;

    window.addEventListener('error', (ev) => {
        const err = ev.error;
        reportError({
            source: 'error',
            message: err?.message ?? ev.message ?? 'Unknown error',
            stack: err?.stack ?? null,
            location: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : null,
            ts: Date.now(),
        });
    });

    window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev.reason;
        let message;
        let stack = null;
        if (reason instanceof Error) {
            message = reason.message;
            stack = reason.stack ?? null;
        } else if (typeof reason === 'string') {
            message = reason;
        } else {
            try {
                message = JSON.stringify(reason);
            } catch {
                message = String(reason);
            }
        }
        reportError({
            source: 'promise',
            message,
            stack,
            location: null,
            ts: Date.now(),
        });
    });
}

/** Programmatic report (e.g. from a widget catch block). */
export function reportApplicationError(source, err) {
    const e = err instanceof Error ? err : new Error(String(err));
    reportError({
        source: source || 'app',
        message: e.message,
        stack: e.stack ?? null,
        location: null,
        ts: Date.now(),
    });
}
