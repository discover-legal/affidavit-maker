/**
 * Verification — the filer's sworn / affirmed statement that the document
 * is true, the jurisdiction's jurat (officer, wording and citations from
 * the profile) and the filer's signature block.
 */

import type { Block, Section } from '../types';
import type { ComposeContext } from '../context';
import { blank, paragraph, partyName, section } from '../record';

export const VERIFICATION_SECTION = 'verification';

export function verificationSection(ctx: ComposeContext, instrument: string): Section {
  const { file, labels, jurisdiction } = ctx;
  const { jurat } = jurisdiction;
  const self = partyName(file, 'self');
  const blocks: Block[] = [];

  if (self.name) {
    blocks.push(
      paragraph(
        `I, ${self.name}, the ${labels.self} in this proceeding, state that I have read this ${instrument} and that the facts stated in it are true to my knowledge, except where stated to be on information and belief, and as to those I believe them to be true.`,
        self.ids,
        false,
      ),
    );
  } else {
    blocks.push(blank('selfName', `Draft — the ${labels.self}'s full legal name is needed for the verification.`, `${labels.self} name`, `I, ___, the ${labels.self} in this proceeding, state that I have read this document and that the facts stated in it are true to my knowledge.`));
  }

  blocks.push({ kind: 'signature', party: 'self', label: `${labels.self}, ${labels.selfRepresented}` });
  blocks.push({ kind: 'jurat', text: jurat.verificationText, officer: jurat.officer, citations: [...jurat.citations] });
  return section(VERIFICATION_SECTION, 'Verification', blocks);
}
