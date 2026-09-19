/**
 * Relief — the prayer. Items derive from what the record actually contains
 * (the petition itself asks for the divorce; children, property, debts and
 * support items appear only when the corresponding record entries do). A
 * list block carries them: a list is not a paragraph and asserts nothing
 * beyond the sections it summarises.
 */

import type { Section } from '../types';
import type { DivorceContext } from '../context';
import { booleanField, confirmed, list, listField, note, section } from '../record';

export const RELIEF_SECTION = 'relief';

export function reliefSection(ctx: DivorceContext): Section {
  const { file, labels, jurisdiction, divorce } = ctx;
  const { maritalProperty, maritalDebts } = jurisdiction.lexicon;
  const items: string[] = [`a ${divorce.instrument.decree} dissolving the marriage of the parties;`];
  if (file.children.length > 0) items.push('orders for the parenting, decision-making and support of the children of the marriage as set out above;');
  if (listField(file, 'propertyItems')) items.push(`a division of the ${maritalProperty};`);
  if (listField(file, 'debtItems')) items.push(`an allocation of the ${maritalDebts};`);
  if (booleanField(file, 'spousalSupportRequested') === true) items.push(`an order for spousal support payable by ${labels.other} to ${labels.self};`);
  else if (confirmed(file, 'support_waived')) items.push('an order recording that both parties waive spousal support;');
  items.push('such further relief as the Court considers just.');

  return section(RELIEF_SECTION, 'Relief Requested', [
    note(`${labels.self} asks the Court for the following relief:`),
    list(items, true),
  ]);
}
