'use strict';

/**
 * Non-destructive merge for structured child lists collected across chat
 * turns. The LLM usually emits only the child under discussion, so the
 * previously collected entries must never be clobbered by assignment —
 * match incoming entries to existing ones by identity and update in place,
 * appending genuinely new children.
 *
 * Identity: normalized name when present, otherwise date of birth (any of
 * the dob/dateOfBirth/birthDate aliases used across the codebase).
 */

const MAX_CHILDREN = 25;

function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function birthDateOf(child) {
  if (!child || typeof child !== 'object') return '';
  const raw = child.dob ?? child.dateOfBirth ?? child.birthDate ?? child.date_of_birth;
  return typeof raw === 'string' ? raw.trim() : '';
}

function isEmptyValue(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function ageOf(child) {
  if (!child || typeof child !== 'object') return null;
  const n = Number(child.age);
  return Number.isFinite(n) ? n : null;
}

function findMatchIndex(list, child) {
  const name = normalizeName(child.name);
  if (name) {
    const byName = list.findIndex((c) => normalizeName(c.name) === name);
    if (byName !== -1) return byName;
    // A first-name-only mention ("remind you about Emma") should update
    // "Emma Smith" rather than duplicate her — but only when unambiguous.
    const prefixMatches = list.reduce((acc, c, i) => {
      const existing = normalizeName(c.name);
      if (existing.startsWith(`${name} `) || name.startsWith(`${existing} `)) acc.push(i);
      return acc;
    }, []);
    if (prefixMatches.length === 1) return prefixMatches[0];
    // Same birth date = same child even when the name was re-spelled
    // ("Emma Smith" → "Emma Smyth" must correct, not duplicate).
  }
  const dob = birthDateOf(child);
  if (dob) {
    return list.findIndex((c) => birthDateOf(c) === dob);
  }
  // Anonymous entry (no name, no dob): fall back to age identity so an LLM
  // re-emitting the same age-only child across turns does not stack copies
  // up to MAX_CHILDREN. Only match against other fully anonymous entries —
  // a named child of the same age is a distinct person.
  if (!name && !dob) {
    const age = ageOf(child);
    if (age !== null) {
      return list.findIndex(
        (c) => !normalizeName(c && c.name) && !birthDateOf(c) && ageOf(c) === age,
      );
    }
  }
  return -1;
}

/**
 * Does the recorded list contain any minor (or age-unknown) child?
 * Used to derive hasMinorChildren without forcing `true` for families
 * whose recorded children are all adults.
 */
function hasMinors(children, now = new Date()) {
  if (!Array.isArray(children) || children.length === 0) return false;
  return children.some((child) => {
    if (!child || typeof child !== 'object') return false;
    const numericAge = Number(child.age);
    if (Number.isFinite(numericAge)) return numericAge < 18;
    const dobRaw = birthDateOf(child);
    if (dobRaw) {
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dobRaw);
      const dob = iso
        ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
        : new Date(dobRaw);
      if (!Number.isNaN(dob.getTime())) {
        return now.getTime() - dob.getTime() < 18 * 365.25 * 24 * 3600 * 1000;
      }
    }
    // Age unknown — assume minor; family-law children lists are minors
    // unless stated otherwise.
    return true;
  });
}

/**
 * The orchestrator tool emits `dob`, the legacy extraction path stores
 * `dateOfBirth`, and the 100+ jurisdiction templates read `birthDate`.
 * Stamp all three aliases so every consumer finds the date.
 */
function normalizeDateAliases(child) {
  const dob = birthDateOf(child);
  if (dob) {
    child.dob = dob;
    child.dateOfBirth = dob;
    child.birthDate = dob;
  }
  return child;
}

/**
 * @param {Array<Object>|undefined} existing - previously collected children
 * @param {Array<Object>|undefined} incoming - children from the current turn
 * @returns {Array<Object>} merged list; never loses an existing entry
 */
function mergeChildren(existing, incoming) {
  const base = Array.isArray(existing)
    ? existing.filter((c) => c && typeof c === 'object').map((c) => ({ ...c }))
    : [];
  if (Array.isArray(incoming)) {
    for (const rawChild of incoming) {
      if (!rawChild || typeof rawChild !== 'object') continue;
      const child = { ...rawChild };
      const idx = findMatchIndex(base, child);
      if (idx === -1) {
        if (base.length < MAX_CHILDREN) {
          base.push(child);
        } else {
          // Silent drops hid a real bug (anonymous same-age entries stacking
          // to the cap because findMatchIndex could not dedupe them). Keep
          // the cap as a safety net but make overflow visible.
          try {
            // eslint-disable-next-line no-console
            console.warn(
              `[childrenMerge] MAX_CHILDREN=${MAX_CHILDREN} reached; dropping incoming child`,
              { droppedName: child && child.name, droppedDob: birthDateOf(child) },
            );
          } catch (_) {
            /* console may be unavailable in some runtimes */
          }
        }
        continue;
      }
      for (const [key, value] of Object.entries(child)) {
        if (isEmptyValue(value)) continue;
        // Keep the more specific recorded name when the update only used a
        // shorter form of it ("Emma" must not overwrite "Emma Smith").
        if (
          key === 'name' &&
          typeof base[idx].name === 'string' &&
          normalizeName(base[idx].name).startsWith(`${normalizeName(value)} `)
        ) {
          continue;
        }
        base[idx][key] = value;
      }
    }
  }
  return base.map(normalizeDateAliases);
}

/**
 * Remove previously collected children by (fuzzy) name match. Used when the
 * user corrects the record ("we only have two kids — drop Emma").
 *
 * @param {Array<Object>|undefined} existing
 * @param {Array<string>|undefined} namesToRemove
 * @returns {Array<Object>}
 */
function removeChildrenByName(existing, namesToRemove) {
  if (!Array.isArray(existing) || existing.length === 0) return [];
  if (!Array.isArray(namesToRemove) || namesToRemove.length === 0) {
    return existing;
  }
  const targets = namesToRemove.map(normalizeName).filter(Boolean);
  if (targets.length === 0) return existing;
  return existing.filter((c) => {
    const name = normalizeName(c && c.name);
    return !targets.some(
      (t) => name === t || name.startsWith(`${t} `) || t.startsWith(`${name} `),
    );
  });
}

/**
 * Human-readable one-line-per-child summary for prompt context blocks.
 * @param {Array<Object>|undefined} children
 * @returns {string} e.g. "1. Emma Smith (DOB 2015-04-02)\n2. Liam Smith (age 7)"
 */
function summarizeChildren(children) {
  if (!Array.isArray(children) || children.length === 0) return '';
  return children
    .map((c, i) => {
      const name = (c && typeof c.name === 'string' && c.name.trim()) || 'Unnamed child';
      const dob = birthDateOf(c);
      const detail = dob
        ? ` (DOB ${dob})`
        : c && (c.age !== undefined && c.age !== null && c.age !== '')
          ? ` (age ${c.age})`
          : '';
      return `${i + 1}. ${name}${detail}`;
    })
    .join('\n');
}

module.exports = { mergeChildren, removeChildrenByName, summarizeChildren, birthDateOf, hasMinors };
