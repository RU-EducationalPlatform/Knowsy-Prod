// User-role resolution.
//
// The authoritative role is a custom claim (`role`) attached to the user's
// Firebase ID token by an admin-side function (see infra/functions/index.js).
// The client just reads it. A student cannot fake "teacher" — claims are
// signed by Firebase and verified by Firestore rules.
//
// Roles:
//   'guest'   — not signed in
//   'student' — default for new accounts
//   'teacher' — set by Cloud Function on accounts whose email is in the
//               teacherEmails allowlist, OR (when Identity Platform is
//               enabled) whose Rutgers SAML affiliation is faculty/staff
//   'admin'   — set manually for site administrators
//
// The custom claim is set asynchronously after sign-up, so a brand-new
// account may briefly read 'student' before the function lands the claim.
// We refresh the token once after that window to pick up the new value.

const NEW_USER_CLAIM_REFRESH_DELAY_MS = 3500;

/** Resolve the current user's role from their ID token claims. */
export async function getUserRole(user) {
  if (!user) return 'guest';
  try {
    const tok = await user.getIdTokenResult();
    return normalizeRole(tok.claims?.role);
  } catch (err) {
    console.warn('[knowsy] role lookup failed:', err);
    return 'student';
  }
}

/** For brand-new users: pull a fresh token shortly after sign-in so the
 *  Cloud Function's role claim is reflected without a manual refresh.
 *  Idempotent — safe to call on every sign-in. */
export async function refreshRoleSoon(user) {
  if (!user) return null;
  await new Promise((r) => setTimeout(r, NEW_USER_CLAIM_REFRESH_DELAY_MS));
  try {
    const tok = await user.getIdTokenResult(true); // force refresh
    return normalizeRole(tok.claims?.role);
  } catch (err) {
    console.warn('[knowsy] forced token refresh failed:', err);
    return null;
  }
}

/** Filter a list of registry entries down to what `role` is allowed to see. */
export function visibleForRole(entries, role) {
  return entries.filter((e) => audienceVisible(e.audience, role));
}

/** True if the given audience tag should be visible to the given role. */
export function audienceVisible(audience, role) {
  if (!audience || audience === 'all') return true;
  if (role === 'admin') return true;
  return audience === role;
}

function normalizeRole(claim) {
  const allowed = new Set(['student', 'teacher', 'admin']);
  return allowed.has(claim) ? claim : 'student';
}
