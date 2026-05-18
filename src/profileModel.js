/** @typedef {'private'|'institution'|'public'|'custom'} ProfileVisibility */

/** @typedef {{ value: string, visibility: ProfileVisibility }} ProfileContactSlot */

/** @typedef {{
 *   organization_name: string,
 *   membership_title?: string,
 *   level?: string,
 *   start_year?: number,
 *   end_year?: number,
 *   visibility?: ProfileVisibility
 * }} ProfileMembership */

export const VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  INSTITUTION: 'institution',
  PUBLIC: 'public',
  CUSTOM: 'custom',
});

function coerceVisibility(v, fallback = VISIBILITY.PRIVATE) {
  const s = v == null ? fallback : String(v);
  return Object.values(VISIBILITY).includes(s) ? s : fallback;
}

export function defaultContactSlot() {
  return { value: '', visibility: VISIBILITY.PRIVATE };
}

export function normalizeContactSlot(slot) {
  if (!slot || typeof slot !== 'object')
    return { ...defaultContactSlot() };
  return {
    value: slot.value != null ? String(slot.value) : '',
    visibility: coerceVisibility(slot.visibility, VISIBILITY.PRIVATE),
  };
}

export function normalizeMembership(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const organization_name =
    raw.organization_name != null ? String(raw.organization_name).trim() : '';
  if (!organization_name) return null;
  /** @type {ProfileMembership} */
  const m = {
    organization_name,
    membership_title:
      raw.membership_title != null ? String(raw.membership_title) : '',
    level: raw.level != null ? String(raw.level) : '',
    visibility: coerceVisibility(raw.visibility, VISIBILITY.PRIVATE),
  };
  if (raw.start_year != null && raw.start_year !== '') {
    const sy = Number(raw.start_year);
    if (Number.isFinite(sy)) m.start_year = Math.round(sy);
  }
  if (raw.end_year != null && raw.end_year !== '') {
    const ey = Number(raw.end_year);
    if (Number.isFinite(ey)) m.end_year = Math.round(ey);
  }
  return m;
}

export function normalizeExtras(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) out[String(k)] = v;
  }
  return out;
}

function clampInt(v, min, max, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeNotesArray(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((n) => n && typeof n === 'object')
    .map((n) => ({
      x: Number.isFinite(+n.x) ? +n.x : 60,
      y: Number.isFinite(+n.y) ? +n.y : 60,
      c: typeof n.c === 'string' ? n.c : 'color-paper',
      text: typeof n.text === 'string' ? n.text : '',
      meta: typeof n.meta === 'string' ? n.meta : '',
    }));
}

function normalizeHeatMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[String(k)] = Math.max(0, Math.round(n));
  }
  return out;
}

export function applyIdentityDefaults(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const memberships = Array.isArray(p.memberships)
    ? p.memberships.map(normalizeMembership).filter(Boolean)
    : [];
  const notes = normalizeNotesArray(p.notes);
  return {
    name: p.name != null ? String(p.name) : '',
    display_name: p.display_name != null ? String(p.display_name) : '',
    pronouns: p.pronouns != null ? String(p.pronouns) : '',
    avatar_url: p.avatar_url != null ? String(p.avatar_url) : '',
    bio: p.bio != null ? String(p.bio) : '',
    email: normalizeContactSlot(p.email),
    phone: normalizeContactSlot(p.phone),
    website: normalizeContactSlot(p.website),
    institution: p.institution != null ? String(p.institution) : '',
    department: p.department != null ? String(p.department) : '',
    position_title: p.position_title != null ? String(p.position_title) : '',
    linkedin: p.linkedin != null ? String(p.linkedin) : '',
    github: p.github != null ? String(p.github) : '',
    orcid: p.orcid != null ? String(p.orcid) : '',
    orcid_verified: Boolean(p.orcid_verified),
    memberships,
    extras: normalizeExtras(p.extras),
    // Editorial extras — used by /profile.html. Kept on the same object so
    // there is exactly one source of truth.
    mood: clampInt(p.mood, 0, 5, 1),
    energy: clampInt(p.energy, 0, 100, 68),
    interests: Array.isArray(p.interests)
      ? p.interests.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
      : [],
    doodleDataUrl: typeof p.doodleDataUrl === 'string' ? p.doodleDataUrl : '',
    photoDataUrl: typeof p.photoDataUrl === 'string' ? p.photoDataUrl : '',
    heat: normalizeHeatMap(p.heat),
    notes: notes ?? [],
  };
}

export function migrateLegacyIdentity(profile) {
  const base = applyIdentityDefaults(profile);
  const p = profile && typeof profile === 'object' ? profile : {};
  if (!base.name.trim()) {
    const fn = p.firstName != null ? String(p.firstName).trim() : '';
    const ln = p.lastName != null ? String(p.lastName).trim() : '';
    base.name = [fn, ln].filter(Boolean).join(' ').trim();
  }
  if (!base.display_name.trim() && p.preferredName != null)
    base.display_name = String(p.preferredName);
  if (!base.avatar_url.trim() && p.avatarDataUrl != null)
    base.avatar_url = String(p.avatarDataUrl);
  const c = p.contact && typeof p.contact === 'object' ? p.contact : {};
  if (!base.email.value.trim() && c.email != null) {
    base.email.value = String(c.email);
    base.email.visibility = c.emailPublic ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE;
  }
  if (!base.phone.value.trim() && c.phone != null) {
    base.phone.value = String(c.phone);
    base.phone.visibility = c.phonePublic ? VISIBILITY.PUBLIC : VISIBILITY.PRIVATE;
  }
  if (!base.github.trim() && p.githubId != null) base.github = String(p.githubId);
  if (!base.linkedin.trim() && p.linkedinId != null) base.linkedin = String(p.linkedinId);
  if (!base.orcid.trim() && p.orcidId != null) base.orcid = String(p.orcidId);
  if (!base.memberships.length && Array.isArray(p.organizations)) {
    base.memberships = p.organizations
      .filter((o) => typeof o === 'string' && o.trim())
      .map((o) => ({
        organization_name: o.trim(),
        visibility: VISIBILITY.PRIVATE,
      }));
  }
  if (!base.department.trim() && p.department != null) base.department = String(p.department);
  return base;
}
