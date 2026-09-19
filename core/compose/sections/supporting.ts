/**
 * Supporting documents (spec 03 §2.5): waiver of service, prove-up
 * affidavit, military status affidavit, indigency affidavit, certificate
 * of last known address, lawyer hand-off summary. Each states only what
 * the record carries and leaves a typed blank for what the user must
 * supply or the court must fill.
 */

import type { Block, Section } from '../types';
import type { ComposeContext, DivorceContext } from '../context';
import { activeFacts } from '../../model/types';
import { formatDate } from '../dates';
import { blank, booleanField, confirmed, dateField, list, note, paragraph, partyId, partyName, section, stringField } from '../record';

// ─── Waiver of service (signed by the OTHER party) ──────────────────────────

export function waiverSections(ctx: DivorceContext): Section[] {
  const { file, labels, divorce } = ctx;
  const other = partyName(file, 'other');
  const blocks: Block[] = [];
  if (other.name) {
    blocks.push(paragraph(`I, ${other.name}, am the ${labels.other} in this case. I have received a copy of the ${divorce.instrument.petition} and I waive formal service of it.`, other.ids));
  } else {
    blocks.push(blank('otherName', `Draft — the ${labels.other}'s full legal name is needed; they sign this document.`, `${labels.other} name`));
  }
  blocks.push(note('Draft — the other party signs this voluntarily, after receiving the initiating document. Some courts require the signature to be notarised and dated after the case is filed.'));
  return [
    section('waiver', 'Waiver of Service', blocks),
    section('signature', undefined, [{ kind: 'signature', party: 'other', label: labels.other }, juratBlock(ctx)]),
  ];
}

// ─── Prove-up affidavit ─────────────────────────────────────────────────────

export function proveUpSections(ctx: DivorceContext): Section[] {
  const { file, labels, jurisdiction, divorce, language } = ctx;
  const self = partyName(file, 'self');
  const blocks: Block[] = [];
  if (self.name) blocks.push(paragraph(`I, ${self.name}, am the ${labels.self}. I am over eighteen and competent to make this affidavit.`, self.ids));
  else blocks.push(blank('selfName', 'Draft — state your full legal name.', 'Affiant'));
  const months = file.fields.residencyMonths?.value;
  if (typeof months === 'number') blocks.push(paragraph(`I have resided in ${jurisdiction.name} for ${months} months.`, ['residencyMonths']));
  else blocks.push(blank('residencyMonths', `Draft — state how long you have lived in ${jurisdiction.name}.`, 'Residency'));
  const marriageDate = dateField(file, 'marriageDate');
  if (marriageDate) blocks.push(paragraph(`The parties were married on ${formatDate(marriageDate, language)}.`, ['marriageDate']));
  else blocks.push(blank('marriageDate', 'Draft — state the date of the marriage.', 'Date of marriage'));
  const ground = divorce.grounds.find((g) => g.code === stringField(file, 'grounds'));
  if (ground) blocks.push(paragraph(`The ground for the divorce is ${ground.label}${ground.citation ? ` (${ground.citation})` : ''}, as pleaded.`, ['grounds']));
  else blocks.push(blank('grounds', 'Draft — the ground for the divorce must be settled before the hearing.', 'Ground'));
  if (file.children.length > 0) blocks.push(paragraph(`The children of the marriage are: ${file.children.map((c, i) => c.name?.value ?? `Child ${i + 1}`).join('; ')}.`, file.children.map((c) => c.id)));
  else if (confirmed(file, 'no_children')) blocks.push(paragraph('There are no children of the marriage.', ['no_children']));
  else blocks.push(blank('children', 'Draft — confirm whether there are children of the marriage.', 'Children'));
  blocks.push(note(`Draft — at the hearing you will also swear that the allegations of the ${divorce.instrument.petition} are true and ask the court to grant the ${divorce.instrument.decree}.`));
  return [section('proveUp', 'Prove-Up Affidavit', blocks), signatureAndJurat(ctx)];
}

// ─── Military status affidavit (SCRA) ───────────────────────────────────────

export function militarySections(ctx: DivorceContext): Section[] {
  const { file, labels } = ctx;
  const other = partyName(file, 'other');
  const blocks: Block[] = [];
  const stated = booleanField(file, 'otherPartyMilitary');
  const who = other.name ?? labels.other;
  if (confirmed(file, 'not_military')) {
    blocks.push(paragraph(`${who} is not on active duty in the armed forces of the United States.`, ['not_military']));
  } else if (stated === true) {
    blocks.push(paragraph(`${who} is on active duty in the armed forces of the United States.`, ['otherPartyMilitary']));
    blocks.push(note('Draft — a servicemember on active duty has protections against default under the Servicemembers Civil Relief Act; the court may appoint counsel or stay the case.'));
  } else {
    blocks.push(blank('militaryStatus', `Draft — state whether ${who} is on active military duty. Search the Department of Defense Manpower Data Center (SCRA website) and attach the certificate; record the date and method of the search.`, 'Military status'));
  }
  blocks.push(blank('searchDate', 'Draft — date and method of the military-status search (e.g. DMDC SCRA certificate).', 'Search'));
  return [section('militaryStatus', 'Military Status', blocks), signatureAndJurat(ctx)];
}

// ─── Indigency affidavit ────────────────────────────────────────────────────

export function indigencySections(ctx: ComposeContext): Section[] {
  const { file } = ctx;
  const self = partyName(file, 'self');
  const blocks: Block[] = [];
  if (self.name) blocks.push(paragraph(`I, ${self.name}, am unable to pay the court costs in this case and ask the court to allow me to proceed without paying them.`, [...self.ids, 'indigencyRequested']));
  else blocks.push(blank('selfName', 'Draft — state your full legal name.', 'Affiant'));
  for (const [id, label, prompt] of [
    ['income', 'Income', 'Draft — list every source and amount of monthly income.'],
    ['expenses', 'Expenses', 'Draft — list monthly expenses (housing, food, utilities, transport, debts).'],
    ['dependents', 'Dependents', 'Draft — list the people who depend on you for support.'],
    ['assets', 'Assets', 'Draft — list bank balances, vehicles and other property you own.'],
    ['publicBenefits', 'Public benefits', 'Draft — list any public benefits you receive; they may qualify you automatically.'],
  ] as const) {
    blocks.push(blank(id, prompt, label));
  }
  blocks.push(note('Draft — the court decides the waiver on these sworn figures; a false statement is perjury.'));
  return [section('indigency', 'Statement of Inability to Pay Costs', blocks), signatureAndJurat(ctx)];
}

// ─── Certificate of last known address ──────────────────────────────────────

export function lastKnownAddressSections(ctx: DivorceContext): Section[] {
  const { file, labels } = ctx;
  const other = partyName(file, 'other');
  const who = other.name ?? labels.other;
  const blocks: Block[] = [];
  const address = file.parties.other.address?.value;
  if (typeof address === 'string' && address.length > 0) {
    blocks.push(paragraph(`The last known address of ${who} is ${address}.`, [partyId('other', 'address')]));
  } else {
    blocks.push(blank('otherAddress', `Draft — state the last address at which ${who} is known to have lived, even if they are no longer there.`, 'Last known address'));
  }
  if (file.parties.other.whereaboutsUnknown?.value === true) {
    blocks.push(paragraph(`The present whereabouts of ${who} are unknown to ${labels.self}.`, [partyId('other', 'whereaboutsUnknown')]));
    const suspected = file.parties.other.suspectedLocation?.value;
    if (typeof suspected === 'string' && suspected.length > 0) {
      blocks.push(paragraph(`${labels.self} has heard, but cannot swear, that ${who} may be in ${suspected}.`, [partyId('other', 'suspectedLocation'), partyId('other', 'whereaboutsUnknown')]));
    }
  }
  blocks.push(blank('diligentEfforts', `Draft — describe every effort made to locate ${who} (people asked, records searched, dates).`, 'Efforts to locate'));
  return [section('lastKnownAddress', 'Certificate of Last Known Address', blocks), signatureAndJurat(ctx)];
}

// ─── Lawyer hand-off summary ────────────────────────────────────────────────

export function handoffSections(ctx: ComposeContext): Section[] {
  const { file, jurisdiction } = ctx;
  const facts = activeFacts(file);
  const snapshot: Block[] = [
    note(`Not a filing. A summary of ${partyName(file, 'self').name ?? 'the client'}'s account for a lawyer's review, prepared from the interview record.`),
    list([
      `Jurisdiction: ${jurisdiction.name} (${jurisdiction.code})`,
      `Matter: ${file.matter ?? 'not yet classified'}`,
      `Role: ${file.role}`,
      `Children on record: ${file.children.length}`,
      `Confirmations on record: ${Object.keys(file.confirmations).join(', ') || 'none'}`,
    ]),
    blank('preparedOn', 'Draft — date this summary was prepared.', 'Prepared on'),
  ];
  const timeline: Block[] = facts.length > 0 ? facts.map((f) => paragraph(f.statement, [f.id])) : [blank('facts', 'Draft — no facts on record yet.', 'Facts')];
  return [
    section('snapshot', 'Case Snapshot', snapshot),
    section('account', 'The Client’s Account', timeline),
    section('questions', 'Open Questions', [note('Draft — the blanks and draft notes in the case documents are the open questions for the lawyer.')]),
  ];
}

// ─── shared ─────────────────────────────────────────────────────────────────

function juratBlock(ctx: ComposeContext): Block {
  const { jurat } = ctx.jurisdiction;
  return { kind: 'jurat', text: jurat.verificationText, officer: jurat.officer, citations: [...jurat.citations] };
}

function signatureAndJurat(ctx: ComposeContext): Section {
  return section('verification', 'Verification', [{ kind: 'signature', party: 'self', label: `${ctx.labels.self}, ${ctx.labels.selfRepresented}` }, juratBlock(ctx)]);
}
