/**
 * Grounds — the legal basis for the divorce, pleaded from the jurisdiction
 * profile's ground list (labels and citations are data, never hard-coded).
 *
 * Gates, all in code:
 *   1. no grounds field → blank + note listing the jurisdiction's grounds;
 *   2. a code outside the profile's set → blank + note (I-11: foreign or
 *      sentinel slugs are never pleaded);
 *   3. separation gate (I-8): where the profile sets
 *      `separationMonthsRequired`, the NO-FAULT ground rests on the
 *      separation period. It is pleaded as satisfied only when the
 *      separation date is on record, date-shaped, and at least that many
 *      months old by Date arithmetic (a partial date counts from its
 *      latest possible day, so the elapsed time is a lower bound).
 *      Otherwise the ground is a blank with a note giving the earliest
 *      filing date and the fault grounds available instead — never a
 *      paragraph, not even one the model drafted;
 *   4. a ground with an `alternative` (TX cruelty → insupportability, I-9)
 *      is pleaded as primary AND in the alternative, with a note.
 */

import type { Ground } from '../../jurisdictions/types';
import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { addMonths, formatDate, isoDate, latestInstant, monthsBetween } from '../dates';
import { blank, dateField, note, paragraph, section, stringField } from '../record';

export const GROUNDS_SECTION = 'grounds';

function describe(g: Ground): string {
  return g.citation ? `${g.label} (${g.citation})` : g.label;
}

export function groundsSection(ctx: DivorceContext): Section {
  const { file, labels, divorce, language } = ctx;
  const available = divorce.grounds.map(describe).join('; ');
  const code = stringField(file, 'grounds');

  // Gate 1 — nothing pleaded.
  if (code === undefined) {
    return section(GROUNDS_SECTION, 'Grounds for Divorce', [
      blank('grounds', `Draft — state the ground for the divorce. Grounds available: ${available}.`, 'Ground', `The ${labels.self} seeks a divorce on the ground that ___.`),
      note('Draft — the ground must be one the court recognises; the interview can help you choose from the list above.'),
    ]);
  }

  // Gate 2 — not one of this jurisdiction's grounds.
  const ground = divorce.grounds.find((g) => g.code === code);
  if (!ground) {
    return section(GROUNDS_SECTION, 'Grounds for Divorce', [
      blank('grounds', `Draft — "${code}" is not a ground this court recognises. Grounds available: ${available}.`, 'Ground', `The ${labels.self} seeks a divorce on the ground that ___.`),
      note('Draft — restate the ground in the interview using one of the grounds listed.'),
    ]);
  }

  const blocks: Block[] = [];
  const separationDate = dateField(file, 'separationDate');

  // Gate 3 — the separation period behind the no-fault ground.
  if (divorce.separationMonthsRequired !== undefined && ground.noFault) {
    const required = divorce.separationMonthsRequired;
    const faultGrounds = divorce.grounds.filter((g) => !g.noFault).map(describe).join('; ');
    const alternatives = faultGrounds.length > 0 ? ` If the separation is shorter, the divorce may instead be sought on: ${faultGrounds}.` : '';
    if (!separationDate) {
      return section(GROUNDS_SECTION, 'Grounds for Divorce', [
        blank('grounds', `Draft — ${describe(ground)} rests on ${required} months of living separate and apart, and no date of separation is on record. State the separation date.${alternatives}`, 'Ground', `The ${labels.self} seeks a divorce on the ground that ___.`),
        note(`Draft — the court cannot grant a divorce on ${ground.label} without the date the parties separated.`),
      ]);
    }
    const since = latestInstant(separationDate);
    const elapsed = monthsBetween(since, new Date());
    if (elapsed < required) {
      const earliest = isoDate(addMonths(since, required));
      return section(GROUNDS_SECTION, 'Grounds for Divorce', [
        blank(
          'grounds',
          `Draft — ${describe(ground)} cannot be pleaded as satisfied yet: the parties separated ${formatDate(separationDate, language)}, which is fewer than ${required} months ago. The parties will have been separated for ${required} months on ${formatDate(earliest, language)}.${alternatives}`,
          'Ground',
        ),
        note(`Draft — do not file on ${ground.label} before ${formatDate(earliest, language)}, or choose another ground in the interview.`),
      ]);
    }
    blocks.push(
      paragraph(
        `The marriage has broken down and there is no reasonable prospect of reconciliation. The parties have lived separate and apart since ${formatDate(separationDate, language)}, a period of at least ${required} months. ${labels.self} pleads ${describe(ground)}.`,
        ['grounds', 'separationDate'],
      ),
    );
  } else {
    const ids = separationDate ? ['grounds', 'separationDate'] : ['grounds'];
    const separated = separationDate ? ` The parties have lived separate and apart since ${formatDate(separationDate, language)}.` : '';
    blocks.push(paragraph(`${labels.self} pleads ${describe(ground)} as the ground for this divorce.${separated}`, ids));
  }

  // Gate 4 — plead the alternative ground the profile attaches (I-9).
  if (ground.alternative) {
    const alternative = divorce.grounds.find((g) => g.code === ground.alternative);
    if (alternative) {
      blocks.push(paragraph(`In the alternative, and without waiving the foregoing, ${labels.self} pleads ${describe(alternative)}.`, ['grounds']));
      blocks.push(
        note(
          `Draft — ${ground.label} is a fault ground: the facts that establish it must be stated in this section and proved at the hearing. ${alternative.label} is pleaded in the alternative so the divorce does not depend on that proof.`,
        ),
      );
    }
  }

  return section(GROUNDS_SECTION, 'Grounds for Divorce', blocks);
}
