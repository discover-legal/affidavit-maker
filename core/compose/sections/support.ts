/**
 * Spousal support — invariant I-1: silence is never a waiver.
 *
 *   spousalSupportRequested === true      → a request paragraph citing the field;
 *   `support_waived` confirmed (no request) → a waiver paragraph supported by exactly that key;
 *   spousalSupportRequested === false alone → a blank + note (not asking ≠ waiving);
 *   field absent                           → a blank.
 *
 * A request wins over a waiver when both are on record: the confirmation
 * cannot be applied to someone who is asking, and the note flags the
 * inconsistency for the interview.
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { blank, booleanField, confirmed, note, paragraph, section } from '../record';

export const SUPPORT_SECTION = 'support';

export function supportSection(ctx: DivorceContext): Section {
  const { file, labels } = ctx;
  const blocks: Block[] = [];
  const requested = booleanField(file, 'spousalSupportRequested');
  const waived = confirmed(file, 'support_waived');

  if (requested === true) {
    blocks.push(paragraph(`${labels.self} requests an order that ${labels.other} pay spousal support to ${labels.self} in an amount and for a period the Court finds just.`, ['spousalSupportRequested']));
    if (waived) blocks.push(note('Draft — the record also contains a confirmation that support was waived. The request has been kept; resolve the inconsistency in the interview.'));
  } else if (waived) {
    blocks.push(paragraph('The parties waive any claim to spousal support from each other, now and in the future.', ['support_waived']));
  } else if (requested === false) {
    // What the user actually said, as a pleading sentence. It is not a
    // waiver, and the blank's note (review pane) explains the difference.
    blocks.push(paragraph(`${labels.self} makes no claim for spousal support at this time.`, ['spousalSupportRequested']));
    blocks.push(
      blank(
        'support',
        `Draft — you said you are not asking for spousal support. That is not the same as waiving it: a waiver is permanent and must be stated expressly, and a court will not infer it from silence. Confirm in the interview whether both parties waive support, or whether the question should be left open (reserved).`,
        'Waiver or reservation of spousal support',
        'The question of spousal support is ___ (waived by both parties / reserved).',
      ),
    );
  } else {
    blocks.push(blank('support', 'Draft — say whether you are asking for spousal support, whether both parties waive it, or whether the question should be left open.', 'Spousal support', `The ${labels.self} ___ (claims / does not claim) spousal support.`));
  }

  return section(SUPPORT_SECTION, 'Spousal Support', blocks);
}
