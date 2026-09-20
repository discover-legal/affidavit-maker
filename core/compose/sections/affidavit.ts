/**
 * Generic affidavit — the user's active facts as numbered sworn
 * paragraphs, each supported by its fact id, between the standard
 * introduction and conclusion (spec 03 §2.1). No model call: the facts
 * already are the user's statements, cleaned at interview time.
 */

import type { Block, Section } from '../types';
import type { ComposeContext } from '../context';
import { activeFacts } from '../../model/types';
import { blank, note, paragraph, partyId, partyName, section } from '../record';

export function introductionSection(ctx: ComposeContext): Section {
  const { file, jurisdiction } = ctx;
  const self = partyName(file, 'self');
  const address = file.parties.self.address?.value;
  const blocks: Block[] = [];
  if (self.name) {
    const ids = [...self.ids];
    let text = `I, ${self.name}`;
    if (typeof address === 'string' && address.length > 0) {
      text += `, of ${address}`;
      ids.push(partyId('self', 'address'));
    }
    text += `, in the ${jurisdiction.lexicon.regionLabel} of ${jurisdiction.name}, make oath and say (or affirm) as follows:`;
    blocks.push(paragraph(text, ids, false));
  } else {
    blocks.push(blank('selfName', 'Draft — state your full legal name as the affiant.', 'Affiant'));
  }
  blocks.push(paragraph('I am over the age of eighteen, of sound mind, and have personal knowledge of the facts stated in this affidavit.', self.ids.length > 0 ? self.ids : [partyId('self', 'firstName')], true));
  return section('introduction', undefined, blocks);
}

export function factsSection(ctx: ComposeContext): Section {
  const facts = activeFacts(ctx.file);
  const blocks: Block[] = facts.map((f) => paragraph(f.statement, [f.id]));
  if (blocks.length === 0) blocks.push(blank('facts', 'Draft — no facts are on record yet. Tell your story in the interview and the numbered paragraphs will be drafted from it.', 'Facts'));
  return section('facts', 'Facts', blocks);
}

export function conclusionSection(): Section {
  return section('conclusion', undefined, [note('I make this affidavit in support of my case and for no improper purpose.')]);
}
