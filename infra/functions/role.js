// Authoritative role assignment.
//
// On user creation:
//   1. Default role = 'student'.
//   2. If the user's email is in the `teacherEmails` allowlist, role = 'teacher'.
//   3. (Identity Platform tier only) If the user's SAML claims include
//      `eduPersonAffiliation` containing 'faculty' or 'staff', role = 'teacher'.
//
// The role is stored in two places:
//   - As a custom claim on the user's ID token  (so Firestore rules can use
//     `request.auth.token.role` and the client can read it without a DB call)
//   - In Firestore at `users/{uid}.role`         (for queries / admin views)
//
// Admins promote a teacher by adding their email to `teacherEmails/{email}`:
//
//     bash infra/scripts/add-teacher.sh someone@rutgers.edu
//
// To demote, delete that doc + run `infra/scripts/recompute-role.sh <uid>`.

import functions from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const RUTGERS_FACULTY_AFFILIATIONS = ['faculty', 'staff', 'employee'];

async function resolveRole({ email, samlAffiliation }) {
  // 1. SAML affiliation (if present and Identity Platform is enabled).
  if (Array.isArray(samlAffiliation)) {
    const lc = samlAffiliation.map((s) => String(s).toLowerCase());
    if (lc.some((a) => RUTGERS_FACULTY_AFFILIATIONS.includes(a))) {
      return { role: 'teacher', via: 'saml-affiliation' };
    }
  }

  // 2. teacherEmails allowlist (works for every auth method).
  if (email) {
    const db = getFirestore();
    const snap = await db.collection('teacherEmails').doc(email.toLowerCase()).get();
    if (snap.exists) return { role: 'teacher', via: 'allowlist' };
  }

  // 3. Default: student.
  return { role: 'student', via: 'default' };
}

async function applyRole(uid, role, profile) {
  const db = getFirestore();
  const auth = getAuth();

  // CRITICAL: setCustomUserClaims REPLACES the entire claim object — it does
  // not merge. We must preserve any pre-existing claims (notably `classes:[…]`,
  // the user's class memberships) or the user loses access to every class on
  // any role re-eval (allowlist toggle, re-signup, etc.).
  const user = await auth.getUser(uid);
  const existing = user.customClaims ?? {};
  await auth.setCustomUserClaims(uid, { ...existing, role });

  // Mirror in Firestore so we can query "all teachers" later.
  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        email: profile.email ?? null,
        displayName: profile.displayName ?? null,
        role,
        roleAssignedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}

/** Triggered on every new Firebase Auth account. */
export const assignRoleOnCreate = functions.auth.user().onCreate(async (user) => {
  const email = user.email ?? null;
  // SAML attributes only flow through here on Identity Platform with a
  // beforeSignIn blocking function — see Phase 2 in the README. For now,
  // user.providerData doesn't carry the affiliation claim.
  const samlAffiliation = null;

  const { role, via } = await resolveRole({ email, samlAffiliation });
  await applyRole(user.uid, role, {
    email,
    displayName: user.displayName ?? null,
  });

  functions.logger.info('assigned role', { uid: user.uid, email, role, via });
});

/** Re-evaluate roles when an admin adds or removes a teacher email.
 *  - On create of teacherEmails/{email}: any user with that email gets promoted.
 *  - On delete: any user with that email gets demoted to student. */
export const refreshRoleOnAllowlistChange = functions.firestore
  .document('teacherEmails/{email}')
  .onWrite(async (change, ctx) => {
    const email = ctx.params.email.toLowerCase();
    const auth = getAuth();
    const db = getFirestore();

    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      // No user yet with that email — they'll be picked up at signup time.
      functions.logger.info('allowlist change for unsigned-up email', { email });
      return;
    }

    const promoted = change.after.exists; // doc exists after write → promote
    const role = promoted ? 'teacher' : 'student';
    await applyRole(user.uid, role, {
      email: user.email ?? email,
      displayName: user.displayName ?? null,
    });
    functions.logger.info('role updated via allowlist', { uid: user.uid, email, role });
  });
