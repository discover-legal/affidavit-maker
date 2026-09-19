/**
 * Parties — who the filer and the other party are and where they live.
 *
 * Legal gate (spec 03 §3 I-10): the other party's residence is pleaded
 * from a stated address; "whereabouts unknown" is pleaded ONLY when the
 * user affirmed it (`parties.other.whereaboutsUnknown === true`), and then
 * a draft note explains that substituted / alternative service needs a
 * court order and a diligent-search showing. Neither → a typed blank.
 */

import type { Block, Section } from '../types';
import type { ComposeContext } from '../context';
import { blank, note, paragraph, partyId, partyName, section } from '../record';

export const PARTIES_SECTION = 'parties';

export function partiesSection(ctx: ComposeContext): Section {
  const { file, labels } = ctx;
  const blocks: Block[] = [];

  // ── The filer ──
  const self = partyName(file, 'self');
  const selfAddress = file.parties.self.address?.value;
  if (self.name) {
    const ids = [...self.ids];
    let text = `${labels.self} is ${self.name}`;
    if (typeof selfAddress === 'string' && selfAddress.length > 0) {
      text += `, who resides at ${selfAddress}`;
      ids.push(partyId('self', 'address'));
    }
    blocks.push(paragraph(`${text}.`, ids));
  } else {
    blocks.push(blank('selfName', `Draft — state the full legal name of the ${labels.self} exactly as it appears on your identification.`, `${labels.self} name`));
  }
  if (typeof selfAddress !== 'string' || selfAddress.length === 0) {
    blocks.push(blank('selfAddress', `Draft — state the ${labels.self}'s residence address; the court uses it for notices.`, `${labels.self} address`));
  }

  // ── The other party ──
  const other = partyName(file, 'other');
  if (other.name) blocks.push(paragraph(`${labels.other} is ${other.name}.`, other.ids));
  else blocks.push(blank('otherName', `Draft — state the full legal name of the ${labels.other} (not a nickname).`, `${labels.other} name`));

  const otherAddress = file.parties.other.address?.value;
  const whereaboutsUnknown = file.parties.other.whereaboutsUnknown?.value === true;
  if (typeof otherAddress === 'string' && otherAddress.length > 0) {
    blocks.push(paragraph(`${labels.other} resides at ${otherAddress} and may be served there.`, [partyId('other', 'address')]));
  } else if (whereaboutsUnknown) {
    // Only an affirmed "I do not know where they are" supports this allegation (I-10).
    blocks.push(paragraph(`The present residence and whereabouts of ${labels.other} are unknown to ${labels.self}.`, [partyId('other', 'whereaboutsUnknown')]));
    const suspected = file.parties.other.suspectedLocation?.value;
    if (typeof suspected === 'string' && suspected.length > 0) {
      blocks.push(
        paragraph(`${labels.self} has heard, but cannot swear, that ${labels.other} may be located in ${suspected}.`, [
          partyId('other', 'suspectedLocation'),
          partyId('other', 'whereaboutsUnknown'),
        ]),
      );
    }
    blocks.push(
      note(
        `Draft — because ${labels.other}'s address is unknown, the court will require a sworn account of the diligent efforts made to find them before it authorises substituted or alternative service (publication, posting, or service on a relative). Keep a record of every attempt.`,
      ),
    );
  } else {
    blocks.push(
      blank('otherAddress', `Draft — state the ${labels.other}'s residence address so they can be served, or say in the interview that you do not know where they are.`, `${labels.other} address`),
    );
  }

  return section(PARTIES_SECTION, 'Parties', blocks);
}
