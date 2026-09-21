/**
 * Residency / jurisdiction — the facts that give this court power to hear
 * the divorce, and the jurisdiction's residency rule, cited from the
 * profile (divorce.residency), never from a hard-coded state table.
 *
 * Legal gate: the allegation that the requirement is MET is pleaded only
 * when the record's months on file reach the profile's minimum. Fewer
 * months → the facts are still stated (they are true) but the section
 * carries a draft note instead of an allegation the court could rely on.
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { COUNTY_ID, blank, note, numberField, paragraph, section } from '../record';

export const RESIDENCY_SECTION = 'residency';

export function residencySection(ctx: DivorceContext): Section {
  const { file, labels, jurisdiction, divorce } = ctx;
  const blocks: Block[] = [];
  const months = numberField(file, 'residencyMonths');
  const county = file.county?.value;
  const rule = divorce.residency;
  const cited = rule.citation ? ` (${rule.citation})` : '';

  if (months !== undefined) {
    const ids = ['residencyMonths'];
    let text = `${labels.self} has resided in ${jurisdiction.name} for ${months} months immediately before the filing of this document`;
    if (typeof county === 'string' && county.length > 0) {
      text += `, and resides in ${county} ${jurisdiction.lexicon.countyLabel}`;
      ids.push(COUNTY_ID);
    }
    blocks.push(paragraph(`${text}.`, ids));

    if (rule.months === undefined || months >= rule.months) {
      blocks.push(paragraph(`The residency requirement of ${jurisdiction.name} is satisfied: ${rule.text}${cited}`, ids));
    } else {
      blocks.push(
        note(
          `Draft — ${jurisdiction.name} requires: ${rule.text}${cited} Your record shows ${months} months. The court cannot grant the divorce until the requirement is met; check the date before filing.`,
        ),
      );
    }
  } else {
    blocks.push(
      blank('residencyMonths', `Draft — state how long the ${labels.self} (or the ${labels.other}) has lived in ${jurisdiction.name}. Requirement: ${rule.text}${cited}`, 'Residency'),
    );
    if (typeof county !== 'string' || county.length === 0) {
      blocks.push(blank(COUNTY_ID, `Draft — state the ${jurisdiction.lexicon.countyLabel} of residence; it fixes the court where the case is filed.`, jurisdiction.lexicon.countyLabel));
    }
  }

  return section(RESIDENCY_SECTION, 'Jurisdiction and Residency', blocks);
}
