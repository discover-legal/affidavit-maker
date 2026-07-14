'use strict';

/**
 * FactOrganizer
 *
 * Deterministic reordering of facts to match the Texas divorce form structure.
 * Called by TXDivorceOrchestrator after each phase to keep facts in the order
 * a court expects, matching the Supreme Court approved TX divorce form sets.
 *
 * Section order (mirrors TX divorce packet structure):
 *   1. Residency / Jurisdiction
 *   2. Marriage facts
 *   3. Children
 *   4. Property & Debts
 *   5. Grounds for divorce
 *   6. Spousal support
 *   7. Service of process
 *   8. Indigency / fee waiver (conditional)
 *   9. Military status
 *  10. General / uncategorized
 */

// Category → section number mapping
const SECTION_ORDER = {
  // Residency and jurisdiction
  residency: 1,
  jurisdiction: 1,

  // Marriage
  marriage: 2,
  marriage_facts: 2,

  // Children
  children: 3,
  parental: 3,
  custody: 3,

  // Property and finances
  property: 4,
  property_division: 4,
  financial: 4,
  assets: 4,
  debts: 4,

  // Grounds
  grounds: 5,

  // Spousal support
  support: 6,
  spousal_support: 6,

  // Service of process
  service: 7,

  // Indigency
  indigency: 8,

  // Military status
  military: 9,
  military_status: 9,
};

const DEFAULT_SECTION = 10; // General / uncategorized falls to the end

/**
 * Returns the section number for a given fact.
 * Uses category, subcategory, and content heuristics.
 *
 * @param {Object|string} fact
 * @returns {number} section number (lower = appears first)
 */
function getSectionForFact(fact) {
  if (typeof fact === 'string') return DEFAULT_SECTION;

  const category = (fact.category || '').toLowerCase().trim();
  const subcategory = (fact.subcategory || '').toLowerCase().trim();

  // Check category first, then subcategory
  if (SECTION_ORDER[category] !== undefined) return SECTION_ORDER[category];
  if (SECTION_ORDER[subcategory] !== undefined) return SECTION_ORDER[subcategory];

  // Heuristic: scan content for section signals
  const content = (fact.content || fact.professionalRewrite || '').toLowerCase();

  if (/\b(reside|resident|lived?|county|months?|domicile)\b/.test(content)) return 1;
  if (/\b(married|marriage|wedding|ceremony|spouse)\b/.test(content)) return 2;
  if (/\b(child|children|minor|custody|visitation|parent)\b/.test(content)) return 3;
  if (/\b(property|asset|debt|account|vehicle|real estate|house|mortgage|credit)\b/.test(content)) return 4;
  if (/\b(insupportab|irreconcilable|grounds?|incompatib)\b/.test(content)) return 5;
  if (/\b(support|maintenance|alimony|spousal)\b/.test(content)) return 6;
  if (/\b(service|citation|waiver|served)\b/.test(content)) return 7;
  if (/\b(indigent|court costs?|unable to afford|fee waiver)\b/.test(content)) return 8;
  if (/\b(military|armed forces|scra|dmdc|servicemember)\b/.test(content)) return 9;

  return DEFAULT_SECTION;
}

function normalizeContent(fact) {
  const content = typeof fact === 'string' ? fact : fact && fact.content;
  return String(content || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Per-turn fact upsert that PRESERVES the existing order.
 *
 * organizeFacts() re-sorts the whole list, which silently undoes any manual
 * drag-and-drop ordering the user did in the review UI. This merge never
 * moves an existing fact:
 *   - a new fact that duplicates an existing one (by id, else by normalized
 *     content) updates it in place;
 *   - a genuinely new fact is inserted after the LAST existing fact of the
 *     same section, so it lands with its topic;
 *   - with no section sibling it is appended at the end.
 *
 * @param {Array} existingFacts - current facts, in user-approved order
 * @param {Array} newFacts - facts extracted this turn
 * @returns {Array} merged facts
 */
function mergeFacts(existingFacts, newFacts) {
  const merged = Array.isArray(existingFacts) ? [...existingFacts] : [];
  if (!Array.isArray(newFacts) || newFacts.length === 0) return merged;

  for (const newFact of newFacts) {
    if (!newFact) continue;

    const id = typeof newFact === 'object' ? newFact.id : undefined;
    const contentKey = normalizeContent(newFact);
    const existingIndex = merged.findIndex((f) => {
      if (id && f && typeof f === 'object' && f.id === id) return true;
      return contentKey !== '' && normalizeContent(f) === contentKey;
    });

    if (existingIndex !== -1) {
      const existing = merged[existingIndex];
      merged[existingIndex] =
        existing && typeof existing === 'object' && typeof newFact === 'object'
          ? { ...existing, ...newFact, id: existing.id || newFact.id }
          : newFact;
      continue;
    }

    const section = getSectionForFact(newFact);
    let insertAt = merged.length;
    for (let i = merged.length - 1; i >= 0; i--) {
      if (getSectionForFact(merged[i]) === section) {
        insertAt = i + 1;
        break;
      }
    }
    merged.splice(insertAt, 0, newFact);
  }

  return merged;
}

/**
 * LEGACY — retained for tests / potential manual re-sort; not called in
 * production. All orchestrators upsert via mergeFacts() instead, because a
 * wholesale re-sort would undo the user's manual fact ordering.
 *
 * Reorder facts array to match TX divorce form section order.
 * Preserves relative order within each section (stable sort).
 * Evidence items are kept adjacent to the fact they were introduced with.
 *
 * @param {Array} facts - Array of fact objects
 * @returns {Array} Reordered facts array
 */
function organizeFacts(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return facts;

  // Annotate each fact with its section number
  const annotated = facts.map((fact, originalIndex) => ({
    fact,
    section: getSectionForFact(fact),
    originalIndex
  }));

  // Stable sort by section number, preserving original order within sections
  annotated.sort((a, b) => {
    if (a.section !== b.section) return a.section - b.section;
    return a.originalIndex - b.originalIndex;
  });

  return annotated.map(a => a.fact);
}

/**
 * Get the human-readable section name for a fact (used for UI grouping).
 *
 * @param {Object|string} fact
 * @returns {string} Section display name
 */
function getSectionName(fact) {
  const section = getSectionForFact(fact);
  const SECTION_NAMES = {
    1: 'Residency & Jurisdiction',
    2: 'Marriage',
    3: 'Children',
    4: 'Property & Debts',
    5: 'Grounds for Divorce',
    6: 'Spousal Support',
    7: 'Service of Process',
    8: 'Court Costs',
    9: 'Military Status',
    10: 'General'
  };
  return SECTION_NAMES[section] || 'General';
}

module.exports = { organizeFacts, mergeFacts, getSectionForFact, getSectionName, SECTION_ORDER };
