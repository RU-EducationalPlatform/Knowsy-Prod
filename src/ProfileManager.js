// Single source of truth for the user's profile. Stored at
// localStorage['knowsy.profile']. Mirrors writes to the legacy
// 'skillgraph_profile' key so existing readers (util/learn/DuolingoBar.js,
// any third-party integrations expecting that schema) keep working.
//
// On first load, normalize() merges in:
//   - the legacy 'skillgraph_profile' object (Dov's shape)
//   - the per-key 'knowsy.*' editorial values (knowsy.doodle, knowsy.photo,
//     knowsy.mood, knowsy.energy, knowsy.xp, knowsy.streak, knowsy.heat,
//     knowsy.interests) — left in place so the navbar's avatar still resolves.
//
// applyAuthDefaults() pulls displayName / email / photoURL from the Firebase
// user the first time a fresh profile is touched, so Create Account flows in.

import { VISIBILITY, applyIdentityDefaults, migrateLegacyIdentity } from './profileModel.js';

const PROFILE_KEY = 'knowsy.profile';
const LEGACY_KEY = 'skillgraph_profile';

function defaultColorVision() {
  return {
    lastScreeningAt: null,
    classification: 'not_assessed',
    platesTotal: null,
    platesMatchedNormal: null,
    platesMatchedRgPattern: null,
    platesMatchedTritanPattern: null,
    summaryLine: '',
    answers: null,
  };
}

function defaultProfile() {
  const joinedAt = new Date().toISOString();
  const id = applyIdentityDefaults({});
  return {
    ...id,
    firstName: '',
    lastName: '',
    preferredName: '',
    firstNamePublic: false,
    lastNamePublic: false,
    preferredNamePublic: false,
    birthdayPublic: false,
    githubPublic: false,
    linkedinPublic: false,
    orcidPublic: false,
    enrolledClassesPublic: false,
    role: 'student',
    contact: {
      email: '',
      emailPublic: false,
      phone: '',
      phonePublic: false,
    },
    githubId: '',
    linkedinId: '',
    orcidId: '',
    birthday: '',
    joinedAt,
    avatarDataUrl: '',
    organizations: [],
    enrolledClasses: [],
    skillAreas: {
      programming: 0,
      electronics: 0,
      math: 0,
      mechanics: 0,
      communication: 0,
    },
    leaderboard: {
      totalXp: 0,
      xp24h: 0,
      xpWeek: 0,
      xpMonth: 0,
      rank: null,
      rankDelta: 0,
      bestRank: null,
      updatedAt: null,
    },
    colorVision: defaultColorVision(),
    xp: 0,
    streak: 0,
    schemaVersion: 1,
  };
}

function syncLegacyAliases(p, identity) {
  const parts = identity.name.trim().split(/\s+/);
  if (!p.firstName) p.firstName = parts[0] || '';
  if (!p.lastName) p.lastName = parts.slice(1).join(' ') || '';
  if (!p.preferredName) p.preferredName = identity.display_name;
  if (!p.avatarDataUrl) p.avatarDataUrl = identity.avatar_url;
  if (identity.department && !p.department) p.department = identity.department;
  p.contact = {
    ...(p.contact && typeof p.contact === 'object' ? p.contact : {}),
    email: identity.email.value || (p.contact?.email ?? ''),
    phone: identity.phone.value || (p.contact?.phone ?? ''),
    emailPublic: identity.email.visibility === VISIBILITY.PUBLIC,
    phonePublic: identity.phone.visibility === VISIBILITY.PUBLIC,
  };
  if (!p.githubId) p.githubId = identity.github;
  if (!p.linkedinId) p.linkedinId = identity.linkedin;
  if (!p.orcidId) p.orcidId = identity.orcid;
  if (!Array.isArray(p.organizations) || p.organizations.length === 0) {
    p.organizations = identity.memberships.map((m) => m.organization_name);
  }
}

// Pull values from the per-key 'knowsy.*' editorial localStorage entries the
// way src/profile.js used to. Only fills fields that aren't set yet, so an
// already-migrated profile won't get overwritten by leftover legacy keys.
function fillFromLegacyKeys(p) {
  if (typeof localStorage === 'undefined') return;
  function safeJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function safeInt(key, fallback) {
    const n = parseInt(localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(n) ? n : fallback;
  }
  if (!p.doodleDataUrl) {
    try { p.doodleDataUrl = localStorage.getItem('knowsy.doodle') || ''; } catch { /* quota */ }
  }
  if (!p.photoDataUrl) {
    try { p.photoDataUrl = localStorage.getItem('knowsy.photo') || ''; } catch { /* quota */ }
  }
  if (p.mood == null) p.mood = safeInt('knowsy.mood', 1);
  if (p.energy == null) p.energy = safeInt('knowsy.energy', 68);
  if (!p.xp) p.xp = safeInt('knowsy.xp', 0);
  if (!p.streak) p.streak = safeInt('knowsy.streak', 0);
  if (!p.heat || Object.keys(p.heat).length === 0) p.heat = safeJson('knowsy.heat', {});
  if (!p.interests || p.interests.length === 0) {
    const arr = safeJson('knowsy.interests', []);
    p.interests = Array.isArray(arr) ? arr : [];
  }
  // Legacy editorial bio + name lived under localStorage['knowsy.profile'].
  // The new schema reads them out as top-level fields; pre-existing flat
  // {name, bio} blobs are picked up by normalize() before we reach here.
}

function normalize(profile) {
  const d = defaultProfile();
  const raw = profile && typeof profile === 'object' ? profile : {};
  let p = { ...d, ...raw };
  const identity = migrateLegacyIdentity(p);
  Object.assign(p, identity);
  syncLegacyAliases(p, identity);

  p.contact = {
    ...d.contact,
    ...(typeof raw.contact === 'object' ? raw.contact : {}),
    ...p.contact,
    email: identity.email.value || p.contact?.email || '',
    phone: identity.phone.value || p.contact?.phone || '',
    emailPublic: identity.email.visibility === VISIBILITY.PUBLIC,
    phonePublic: identity.phone.visibility === VISIBILITY.PUBLIC,
  };

  p.memberships = identity.memberships;
  p.extras = identity.extras;
  p.bio = identity.bio;
  p.mood = identity.mood;
  p.energy = identity.energy;
  p.interests = identity.interests;
  p.doodleDataUrl = identity.doodleDataUrl;
  p.photoDataUrl = identity.photoDataUrl;
  p.heat = identity.heat;
  p.notes = identity.notes;

  fillFromLegacyKeys(p);

  p.enrolledClasses = Array.isArray(raw.enrolledClasses) ? raw.enrolledClasses : [];
  p.skillAreas = { ...d.skillAreas, ...(raw.skillAreas || {}) };
  p.leaderboard = { ...d.leaderboard, ...(raw.leaderboard || {}) };
  p.colorVision = { ...defaultColorVision(), ...(raw.colorVision || {}) };
  p.joinedAt = raw.joinedAt || d.joinedAt;
  p.xp = Number.isFinite(+p.xp) ? Math.max(0, Math.round(+p.xp)) : 0;
  p.streak = Number.isFinite(+p.streak) ? Math.max(0, Math.round(+p.streak)) : 0;
  p.schemaVersion = 1;

  const cvClass = p.colorVision.classification;
  const allowedCv = [
    'not_assessed',
    'likely_normal',
    'possible_red_green_deficiency',
    'possible_tritan_deficiency',
    'inconclusive',
  ];
  if (!allowedCv.includes(cvClass)) p.colorVision.classification = 'not_assessed';
  if (!['student', 'professor', 'staff'].includes(p.role)) p.role = 'student';

  for (const k of Object.keys(p.skillAreas)) {
    const n = Number(p.skillAreas[k]);
    p.skillAreas[k] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  for (const k of ['totalXp', 'xp24h', 'xpWeek', 'xpMonth', 'rankDelta']) {
    const n = Number(p.leaderboard[k]);
    p.leaderboard[k] = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  if (p.leaderboard.rank != null) {
    const r = Number(p.leaderboard.rank);
    p.leaderboard.rank = Number.isFinite(r) && r > 0 ? Math.round(r) : null;
  }
  if (p.leaderboard.bestRank != null) {
    const r = Number(p.leaderboard.bestRank);
    p.leaderboard.bestRank = Number.isFinite(r) && r > 0 ? Math.round(r) : null;
  }
  return p;
}

// Read knowsy.profile first; on a cold start (key absent) fall back to the
// legacy skillgraph_profile blob so users who edited via the old catalog
// widget don't lose their work.
function readRaw(storage) {
  const fresh = storage.get(PROFILE_KEY, null);
  if (fresh && typeof fresh === 'object') return fresh;
  const legacy = storage.get(LEGACY_KEY, null);
  if (legacy && typeof legacy === 'object') return legacy;
  return defaultProfile();
}

// Mirror to the legacy key so unaware code paths (DuolingoBar reads
// leaderboard.rank from skillgraph_profile, etc.) stay in sync without
// touching them.
function writeBoth(storage, profile) {
  storage.set(PROFILE_KEY, profile);
  storage.set(LEGACY_KEY, profile);
}

/** Hydrate a fresh profile from the Firebase auth user object. Only fills
 *  blank fields — never overwrites anything the user has already edited. */
function applyAuthDefaults(profile, user) {
  if (!user) return profile;
  const p = { ...profile };
  const dn = (user.displayName || '').trim();
  const em = (user.email || '').trim();
  const photo = (user.photoURL || '').trim();
  if (!p.name && dn) p.name = dn;
  if (!p.display_name && dn) p.display_name = dn;
  if (!p.email || !p.email.value) {
    p.email = { value: em, visibility: VISIBILITY.PRIVATE };
  }
  if (!p.contact?.email && em) {
    p.contact = { ...(p.contact || {}), email: em };
  }
  if (!p.avatar_url && photo) p.avatar_url = photo;
  if (!p.avatarDataUrl && photo) p.avatarDataUrl = photo;
  return p;
}

const ProfileManager = {
  load(storage) {
    return normalize(readRaw(storage));
  },
  save(storage, profile) {
    const next = normalize(profile);
    writeBoth(storage, next);
    return next;
  },
  /** Load + hydrate from a Firebase user, then persist if anything changed. */
  loadForUser(storage, user) {
    const before = readRaw(storage);
    const hydrated = applyAuthDefaults(before, user);
    const normalized = normalize(hydrated);
    writeBoth(storage, normalized);
    return normalized;
  },
  applyAuthDefaults,
  defaultProfile,
  normalize,
  VISIBILITY,
  PROFILE_KEY,
};

export default ProfileManager;
