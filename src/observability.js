// Single entry point for everything observability-related: error tracking,
// performance metrics, structured logs, user identification.
//
// Why one file? So every page imports the same thing and we're not chasing
// inconsistent setups across landing/login/app. If you need to swap Sentry for
// something else later, this is the only file that has to change.

import * as Sentry from '@sentry/browser';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { installErrorOverlay, reportApplicationError } from '../util/ErrorOverlay.js';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const release = import.meta.env.VITE_APP_VERSION ?? 'dev';
const env = import.meta.env.MODE; // 'development' | 'production'

let sentryReady = false;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: env,
      release,
      // Sample 100% of errors (cheap), but only 10% of perf traces in prod.
      tracesSampleRate: env === 'production' ? 0.1 : 1.0,
      // Anonymize IPs by default — we don't need them and it's friendlier to users.
      sendDefaultPii: false,
      integrations: [Sentry.browserTracingIntegration()],
      beforeSend(event) {
        // Drop noise: extension errors and third-party junk we can't fix.
        const msg = event.exception?.values?.[0]?.value ?? '';
        if (/extension|chrome-extension|moz-extension/i.test(msg)) return null;
        return event;
      },
    });
    sentryReady = true;
  } catch (err) {
    // Don't let observability take down the app.
    console.warn('[knowsy] Sentry init failed:', err);
  }
}

// Always install the in-page error toast. Provides a real-user-facing surface
// for errors even if Sentry is off (free-tier exhausted, DSN not set, etc.).
installErrorOverlay();

// ---- Web Vitals → Sentry ---------------------------------------
// These are the metrics Google ranks pages on (Core Web Vitals: LCP, INP, CLS)
// plus FCP and TTFB for context. Reported to Sentry as measurements so we can
// see distribution + regressions over time.
function sendVital(metric) {
  if (!sentryReady) {
    console.debug('[vitals]', metric.name, metric.value, metric.rating);
    return;
  }
  // Sentry's measurement API expects a unit; CLS is unitless.
  const unit = metric.name === 'CLS' ? '' : 'millisecond';
  try {
    Sentry.setMeasurement(metric.name, metric.value, unit);
  } catch {
    // setMeasurement only works inside an active transaction; fall back to a
    // tagged message so we still capture the value.
    Sentry.captureMessage(`vital:${metric.name}`, {
      level: 'info',
      tags: { vital: metric.name, rating: metric.rating },
      extra: { value: metric.value, id: metric.id },
    });
  }
}
onCLS(sendVital);
onLCP(sendVital);
onINP(sendVital);
onFCP(sendVital);
onTTFB(sendVital);

// ---- Public API ------------------------------------------------

/** Record an exception. Shows the user the in-page overlay AND reports to Sentry. */
export function captureError(err, context = {}) {
  reportApplicationError(context.source ?? 'app', err);
  if (sentryReady) Sentry.captureException(err, { extra: context });
}

/** Record a non-error event (auth success, lesson started, etc.). */
export function captureMessage(message, level = 'info', context = {}) {
  if (sentryReady) Sentry.captureMessage(message, { level, extra: context });
  if (env !== 'production') console.log(`[${level}] ${message}`, context);
}

/** Tag the current session with the signed-in user. Call after login + on signOut(null). */
export function setUser(user) {
  if (!sentryReady) return;
  Sentry.setUser(user ? { id: user.uid, email: user.email } : null);
}

/** Add a breadcrumb — a small log entry that will appear with any later error. */
export function breadcrumb(message, data = {}) {
  if (sentryReady) Sentry.addBreadcrumb({ message, data, level: 'info' });
}

export const observability = {
  ready: sentryReady,
  release,
  env,
};

// ---- Service worker registration --------------------------------
// Only in production builds. Dev mode runs without the SW so you don't fight
// stale caches while editing.
if (env === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        breadcrumb('sw_registered', { scope: reg.scope });
      })
      .catch((err) => {
        // Don't block the app if SW registration fails (e.g. private browsing).
        console.warn('[knowsy] service worker registration failed:', err);
      });
  });
}
