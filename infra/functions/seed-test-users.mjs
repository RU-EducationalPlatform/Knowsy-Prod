// Seed test users + starter classes into the running Firebase emulator.
//
// Run from the repo root:
//   node infra/functions/seed-test-users.mjs
//
// The script lives in infra/functions/ so it can resolve firebase-admin from
// that directory's node_modules (we don't add admin as a root devDep just to
// run a one-off seed).
//
// Idempotent: safe to re-run. Users keep their UIDs; classes use deterministic
// IDs so re-running doesn't create duplicates.

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'demo-knowsy';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ projectId: 'demo-knowsy' });

const auth = getAuth();
const db = getFirestore();

// ---------- catalog ----------

function currentTerm() {
  const d = new Date();
  const y = d.getFullYear();
  const season = d.getMonth() < 5 ? 'Spring' : (d.getMonth() < 8 ? 'Summer' : 'Fall');
  return `${season} ${y}`;
}

// Deterministic class ids + join codes so re-runs are idempotent.
const SEED_CLASSES = [
  {
    id: 'seed-ece224',
    name: 'Programming Methodology II (C++)',
    courseCode: 'ECE 224',
    moduleIds: ['cpp-exec-opt', 'parallel-simd'],
    joinCode: 'CPP224',
  },
  {
    id: 'seed-ece332',
    name: 'Theory and Design of Logic Circuits',
    courseCode: 'ECE 332',
    moduleIds: ['bitinterp', 'balab', 'kmap', 'ecc', 'integer-overflow', 'verilog'],
    joinCode: 'LOG332',
  },
];

// ---------- helpers ----------

async function ensureUser({ email, password, displayName }) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName, emailVerified: true });
    console.log(`  exists, refreshed: ${email} (uid=${user.uid})`);
  } catch {
    user = await auth.createUser({ email, password, displayName, emailVerified: true });
    console.log(`  created:           ${email} (uid=${user.uid})`);
  }
  return user;
}

async function setClaimsAndMirror(uid, { email, displayName, role, classes }) {
  // setCustomUserClaims replaces, not merges — pass the full claim object every time.
  await auth.setCustomUserClaims(uid, { role, classes });
  await db.collection('users').doc(uid).set(
    {
      email,
      displayName,
      role,
      roleAssignedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function seedClasses(dovUid, avaUid) {
  const term = currentTerm();
  for (const c of SEED_CLASSES) {
    // The class itself.
    await db.collection('classes').doc(c.id).set(
      {
        teacherUid: dovUid,
        name: c.name,
        courseCode: c.courseCode,
        term,
        moduleIds: c.moduleIds,
        createdAt: FieldValue.serverTimestamp(),
        legacySeed: true,
      },
      { merge: true },
    );
    // Roster: Ava enrolled.
    await db.collection('classes').doc(c.id).collection('members').doc(avaUid).set(
      {
        role: 'student',
        joinedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    // Join code (admin-only collection; clients resolve via joinClassByCode).
    await db.collection('classCodes').doc(c.joinCode).set(
      {
        classId: c.id,
        createdBy: dovUid,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`  ${c.courseCode.padEnd(8)} → /classes/${c.id}  (join: ${c.joinCode})`);
  }
  return SEED_CLASSES.map((c) => c.id);
}

// ---------- main ----------

async function main() {
  console.log('Seeding emulator (demo-knowsy)…\n');

  console.log('Allowlist:');
  await db.collection('teacherEmails').doc('dov@test.com').set(
    { addedAt: FieldValue.serverTimestamp(), note: 'seed: Dov Kruger' },
    { merge: true },
  );
  console.log('  teacherEmails/dov@test.com written\n');

  console.log('Users:');
  const dov = await ensureUser({
    email: 'dov@test.com',
    password: 'knowsy2026',
    displayName: 'Dov Kruger',
  });
  const ava = await ensureUser({
    email: 'ava@test.com',
    password: 'knowsy2026',
    displayName: 'Ava',
  });

  console.log('\nClasses:');
  const classIds = await seedClasses(dov.uid, ava.uid);

  console.log('\nCustom claims (role + classes):');
  await setClaimsAndMirror(dov.uid, {
    email: 'dov@test.com',
    displayName: 'Dov Kruger',
    role: 'teacher',
    classes: classIds,
  });
  console.log(`  dov  → { role:teacher, classes:[${classIds.length}] }`);
  await setClaimsAndMirror(ava.uid, {
    email: 'ava@test.com',
    displayName: 'Ava',
    role: 'student',
    classes: classIds,
  });
  console.log(`  ava  → { role:student, classes:[${classIds.length}] }`);

  console.log('\n────────────────  Login  ────────────────');
  console.log(' Teacher  dov@test.com   knowsy2026');
  console.log(' Student  ava@test.com   knowsy2026');
  console.log('───────────────  Classes  ───────────────');
  for (const c of SEED_CLASSES) {
    console.log(` ${c.courseCode.padEnd(8)} ${c.name.padEnd(38)} join: ${c.joinCode}`);
  }
  console.log('─────────────────────────────────────────');
  console.log('\nSign in at http://localhost:5173/login.html. After sign-in,');
  console.log('hard-refresh once so the new classes claim flows into the token.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
