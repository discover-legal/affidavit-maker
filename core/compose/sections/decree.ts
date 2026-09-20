/**
 * Decree / order sections — the proposed final instrument, in the
 * jurisdiction's order vocabulary (lexicon.orderIntro). Orders are
 * proposed only for what the record contains; every dispositive clause
 * (no property, no debts, support waived, no children) comes from its
 * confirmation and nothing else (spec 03 §2.3, I-1, I-2).
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { formatDate } from '../dates';
import { blank, booleanField, confirmed, dateField, list, listField, note, paragraph, partyName, section, stringField } from '../record';

export function appearancesSection(ctx: DivorceContext): Section {
  const { file, labels } = ctx;
  const blocks: Block[] = [];
  for (const side of ['self', 'other'] as const) {
    const label = side === 'self' ? labels.self : labels.other;
    const party = partyName(file, side);
    if (party.name) blocks.push(paragraph(`${label}, ${party.name}.`, party.ids, false));
    else blocks.push(blank(`${side}Name`, `Draft — the ${label}'s full legal name is needed for the order.`, `${label} name`));
  }
  blocks.push(note('Draft — the court records how each party appeared (in person, by counsel, or not at all) at the hearing; leave that to the court.'));
  return section('appearances', 'Appearances', blocks);
}

export function findingsSection(ctx: DivorceContext): Section {
  const { file, labels, divorce, language } = ctx;
  const blocks: Block[] = [];
  const marriageDate = dateField(file, 'marriageDate');
  if (marriageDate) blocks.push(paragraph(`The Court finds that the parties were married on ${formatDate(marriageDate, language)}.`, ['marriageDate']));
  else blocks.push(blank('marriageDate', 'Draft — the date of the marriage is needed for the findings.', 'Date of marriage'));
  const code = stringField(file, 'grounds');
  const ground = divorce.grounds.find((g) => g.code === code);
  if (ground) blocks.push(paragraph(`The Court finds that the ground of ${ground.label}${ground.citation ? ` (${ground.citation})` : ''} pleaded by ${labels.self} is established.`, ['grounds']));
  else blocks.push(blank('grounds', 'Draft — the ground for the divorce is not settled on the record; see the petition.', 'Ground'));
  return section('findings', 'Findings', blocks);
}

export function dissolutionSection(ctx: DivorceContext): Section {
  const { file, jurisdiction, divorce } = ctx;
  const { orderIntro } = jurisdiction.lexicon;
  const self = partyName(file, 'self');
  const other = partyName(file, 'other');
  const blocks: Block[] = [];
  if (self.name && other.name) {
    blocks.push(paragraph(`${orderIntro} that the marriage of ${self.name} and ${other.name} is dissolved.`, [...self.ids, ...other.ids], false));
  } else {
    blocks.push(blank('parties', 'Draft — both parties’ full legal names are needed for the dissolution order.', 'Parties'));
  }
  if (divorce.waitingPeriod) blocks.push(note(`Draft — ${jurisdiction.name} waiting period: ${divorce.waitingPeriod.text}${divorce.waitingPeriod.citation ? ` (${divorce.waitingPeriod.citation})` : ''}.`));
  return section('dissolution', 'Dissolution', blocks);
}

export function decreeChildrenSection(ctx: DivorceContext): Section {
  const { file, jurisdiction } = ctx;
  const { orderIntro } = jurisdiction.lexicon;
  const blocks: Block[] = [];
  if (file.children.length > 0) {
    blocks.push(paragraph(`${orderIntro} that the following are the children of the marriage: ${file.children.map((c, i) => c.name?.value ?? `Child ${i + 1}`).join('; ')}.`, file.children.map((c) => c.id), false));
    blocks.push(blank('parentingOrders', 'Draft — the parenting, decision-making and child support orders are set at the hearing from the parenting arrangement and the support guidelines; state the arrangement you propose in the interview.', 'Parenting orders'));
  } else if (confirmed(file, 'no_children')) {
    blocks.push(paragraph('There are no children of the marriage.', ['no_children'], false));
  } else {
    blocks.push(blank('children', 'Draft — confirm whether there are children of the marriage.', 'Children'));
  }
  return section('children', 'Children', blocks);
}

export function decreePropertySection(ctx: DivorceContext): Section {
  const { file, jurisdiction } = ctx;
  const { orderIntro, maritalProperty, maritalDebts } = jurisdiction.lexicon;
  const blocks: Block[] = [];
  const items = listField(file, 'propertyItems');
  if (items) {
    blocks.push(paragraph(`${orderIntro} that the ${maritalProperty} of the parties, being the following, is divided as set out below:`, ['propertyItems'], false));
    blocks.push(list(items));
    blocks.push(blank('propertyDivision', `Draft — state which party receives each item; the draft assigns nothing.`, 'Division'));
  } else if (confirmed(file, 'no_property')) {
    blocks.push(paragraph(`The Court finds that there is no ${maritalProperty} to be divided.`, ['no_property'], false));
  } else {
    blocks.push(blank('property', `Draft — list the ${maritalProperty} or confirm there is none.`, 'Property'));
  }
  const debts = listField(file, 'debtItems');
  if (debts) {
    blocks.push(paragraph(`${orderIntro} that the ${maritalDebts} of the parties, being the following, are allocated as set out below:`, ['debtItems'], false));
    blocks.push(list(debts));
    blocks.push(blank('debtAllocation', 'Draft — state which party is responsible for each debt; the draft assigns nothing.', 'Allocation'));
  } else if (confirmed(file, 'no_debts')) {
    blocks.push(paragraph(`The Court finds that there are no ${maritalDebts} to be allocated.`, ['no_debts'], false));
  } else {
    blocks.push(blank('debts', `Draft — list the ${maritalDebts} or confirm there are none.`, 'Debts'));
  }
  return section('property', 'Property and Debts', blocks);
}

export function decreeSupportSection(ctx: DivorceContext): Section {
  const { file, labels, jurisdiction } = ctx;
  const { orderIntro } = jurisdiction.lexicon;
  const blocks: Block[] = [];
  const requested = booleanField(file, 'spousalSupportRequested');
  if (requested === true) {
    blocks.push(paragraph(`${orderIntro} that ${labels.other} pay spousal support to ${labels.self} in the amount and for the period set out below.`, ['spousalSupportRequested'], false));
    blocks.push(blank('supportAmount', 'Draft — amount, frequency and duration are fixed by the court or by agreement; state what you ask for in the interview.', 'Amount'));
  } else if (confirmed(file, 'support_waived')) {
    blocks.push(paragraph(`${orderIntro} that neither party shall pay spousal support to the other, both having waived it.`, ['support_waived'], false));
  } else {
    blocks.push(blank('support', 'Draft — spousal support is neither requested nor waived on the record; no order is proposed. Resolve this in the interview.', 'Spousal support'));
  }
  return section('support', 'Spousal Support', blocks);
}

export function judgmentSection(): Section {
  return section('judgment', 'Signature of the Court', [
    blank('judgeSignature', 'Court use only — the judge signs and dates the order at the hearing.', 'Judge'),
  ]);
}
