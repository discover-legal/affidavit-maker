'use strict';

/**
 * Shared per-section numbering logic.
 *
 * Both the React preview (components/app/DocumentPreview.js) and the
 * PDF/DOCX renderers (services/pdfService.js) call this so the two
 * outputs can't drift on which paragraphs get "1.", "2.", "a.", etc.
 *
 * Rules (per titled section like propertyDivision, finalOrders):
 *   1. Items with `letter` → "a. ", "b. ", … (template wins).
 *   2. Items with `number` → "1. ", "2. ", … (template wins).
 *   3. Otherwise, auto-number per-section starting at 1, but ONLY when
 *      no item in the section had its own .number/.letter — sections
 *      that mix prose intros with lettered items (e.g. the petition
 *      reliefRequested block) are left alone.
 *   4. Bullets (`• …`), pre-numbered children (`"1. Bob Jr"`), and
 *      sub-item types like `property_item`/`child_item` never consume
 *      a counter slot, so we don't double-prefix.
 */

const BULLET_RE = /^[•○▪◦●–\-]\s/;
const INLINE_NUMBER_RE = /^\s*\d+[.)]\s/;
const SUB_ITEM_TYPE_RE = /_item$/;

function isBulletOrSubItem(item) {
  if (!item) return true;
  const content = String(item.content || '');
  return (
    BULLET_RE.test(content.trim()) ||
    SUB_ITEM_TYPE_RE.test(item.type || '') ||
    INLINE_NUMBER_RE.test(content)
  );
}

/**
 * Build a stateful prefixer for one section's items.
 *
 *   const nextPrefix = makeSectionPrefixer(section.items);
 *   section.items.forEach(item => {
 *     const prefix = nextPrefix(item); // "1. " | "a. " | ""
 *     render(prefix + item.content);
 *   });
 */
function makeSectionPrefixer(items) {
  const list = Array.isArray(items) ? items : [];
  const sectionHasNumbering = list.some(
    (it) => it && (it.letter || it.number != null),
  );
  let auto = 0;
  return function nextPrefix(item) {
    if (!item) return '';
    if (item.letter) return `${item.letter}. `;
    if (item.number != null) return `${item.number}. `;
    if (sectionHasNumbering) return '';
    if (isBulletOrSubItem(item)) return '';
    auto += 1;
    return `${auto}. `;
  };
}

module.exports = { makeSectionPrefixer, isBulletOrSubItem };
