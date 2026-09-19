/**
 * Answer sections — the responding party's document. Invariant I-12: the
 * answer transcribes and never decides. The admissions scaffold is a list
 * the respondent marks up (admit / deny / no knowledge) with a note; the
 * only paragraphs are the respondent's OWN stated facts, each cited. No
 * defence and no claim is asserted unless the record supports it.
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { formatDate, isRenderableDate } from '../dates';
import { blank, booleanField, dateField, list, listField, note, paragraph, section, stringField } from '../record';

export const ADMISSIONS_SECTION = 'admissions';
export const DEFENSES_SECTION = 'defenses';
export const CLAIM_SECTION = 'claim';

/** The topics an initiating divorce pleading covers, one line each for the respondent to answer. */
const SCAFFOLD_TOPICS = [
  'the parties and their addresses',
  'residency and the jurisdiction of the court',
  'the date and place of the marriage',
  'the date of separation',
  'the ground for divorce',
  'the children of the marriage and their residence',
  'property',
  'debts',
  'spousal support',
  'the relief requested',
];

export function admissionsSection(ctx: DivorceContext): Section {
  const { file, labels, divorce, language } = ctx;
  const blocks: Block[] = [];

  blocks.push(
    note(
      `Draft — for every numbered paragraph of the ${divorce.instrument.petition}, mark ONE response: ADMITS, DENIES, or HAS NO KNOWLEDGE. A paragraph left unanswered may be treated as admitted. Nothing below has been decided for you.`,
    ),
  );
  blocks.push(list(SCAFFOLD_TOPICS.map((topic) => `Paragraph __ (${topic}): ADMITS / DENIES / HAS NO KNOWLEDGE (mark one)`), true));

  // The respondent's own statements, transcribed with provenance — not admissions of anything alleged.
  const marriageDate = dateField(file, 'marriageDate');
  const marriagePlace = stringField(file, 'marriagePlace');
  if (marriageDate || marriagePlace) {
    const ids: string[] = [];
    const parts: string[] = [`${labels.self} states that the parties were married`];
    if (marriageDate) {
      parts.push(`on ${formatDate(marriageDate, language)}`);
      ids.push('marriageDate');
    }
    if (marriagePlace) {
      parts.push(`in ${marriagePlace}`);
      ids.push('marriagePlace');
    }
    blocks.push(paragraph(`${parts.join(' ')}.`, ids));
  }
  const separationDate = dateField(file, 'separationDate');
  if (separationDate) blocks.push(paragraph(`${labels.self} states that the parties separated on ${formatDate(separationDate, language)}.`, ['separationDate']));

  for (const child of file.children) {
    const name = child.name?.value;
    if (!name) continue;
    const dob = child.dateOfBirth?.value;
    const born = typeof dob === 'string' && isRenderableDate(dob) ? `, born ${formatDate(dob, language)},` : '';
    blocks.push(paragraph(`${labels.self} states that ${name}${born} is a child of the marriage.`, [child.id]));
  }

  return section(ADMISSIONS_SECTION, 'Response to the Allegations', blocks);
}

export function defensesSection(ctx: DivorceContext): Section {
  const { jurisdiction, labels } = ctx;
  const title = jurisdiction.country === 'US' ? 'Affirmative Defenses' : 'Defences';
  return section(DEFENSES_SECTION, title, [
    blank('defenses', `Draft — state any defence the ${labels.self} raises (for example a prior agreement between the parties, or that the residency requirement is not met). None has been asserted from the record; a defence not pleaded may be lost.`, title),
  ]);
}

/** The respondent's own claim, titled from the lexicon (Counter-Petition / Answer with Claim / Counterclaim); items only from stated fields. */
export function claimSection(ctx: DivorceContext): Section {
  const { file, labels, jurisdiction } = ctx;
  const { counterClaimTitle, maritalProperty, maritalDebts } = jurisdiction.lexicon;
  const blocks: Block[] = [];
  const items: string[] = [];

  if (booleanField(file, 'spousalSupportRequested') === true) {
    blocks.push(paragraph(`${labels.self} claims spousal support from ${labels.other}.`, ['spousalSupportRequested']));
    items.push(`an order for spousal support payable by ${labels.other} to ${labels.self};`);
  }
  if (file.children.some((c) => c.residesWith?.value === 'self')) {
    const ids = file.children.filter((c) => c.residesWith?.value === 'self').map((c) => c.id);
    blocks.push(paragraph(`The children named above reside with ${labels.self}, who asks that this arrangement continue.`, ids));
    items.push('orders for the parenting and support of the children of the marriage;');
  }
  const property = listField(file, 'propertyItems');
  if (property) {
    blocks.push(paragraph(`${labels.self} states that the parties own the following ${maritalProperty}:`, ['propertyItems']));
    blocks.push(list(property));
    items.push(`a division of the ${maritalProperty};`);
  }
  const debts = listField(file, 'debtItems');
  if (debts) {
    blocks.push(paragraph(`${labels.self} states that the parties owe the following ${maritalDebts}:`, ['debtItems']));
    blocks.push(list(debts));
    items.push(`an allocation of the ${maritalDebts};`);
  }

  if (items.length > 0) {
    blocks.push(note(`${labels.self} asks the Court for:`));
    blocks.push(list(items, true));
  } else {
    blocks.push(blank('claim', `Draft — a ${counterClaimTitle} is optional. State in the interview what orders you want the court to make, or leave this part out.`, counterClaimTitle));
  }
  blocks.push(note(`Draft — this ${counterClaimTitle} contains only what you told us. It makes no claim you did not state.`));

  return section(CLAIM_SECTION, counterClaimTitle, blocks);
}
