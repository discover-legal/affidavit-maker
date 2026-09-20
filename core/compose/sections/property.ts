/**
 * Property and debts — the marital estate as the record states it, in the
 * jurisdiction's vocabulary (community / marital / family property).
 *
 * Invariant I-2: "there is no property" / "no debts" is dispositive and
 * renders ONLY from the `no_property` / `no_debts` confirmations, each
 * supported by exactly that key. Silence (no items, no confirmation)
 * renders a blank with a note. Stated items render an allegation citing the
 * items field, never a nil clause.
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { blank, confirmed, list, listField, paragraph, section } from '../record';

export const PROPERTY_SECTION = 'property';

export async function propertySection(ctx: DivorceContext): Promise<Section> {
  const { file, labels, jurisdiction } = ctx;
  const { maritalProperty, maritalDebts } = jurisdiction.lexicon;
  const blocks: Block[] = [];

  const items = listField(file, 'propertyItems');
  if (items) {
    blocks.push(paragraph(`The parties have acquired ${maritalProperty} during the marriage, including the following:`, ['propertyItems']));
    blocks.push(list(items));
    blocks.push(paragraph(`${labels.self} asks the Court to divide the ${maritalProperty} between the parties in accordance with the law of ${jurisdiction.name}.`, ['propertyItems']));
  } else if (confirmed(file, 'no_property')) {
    blocks.push(paragraph(`There is no ${maritalProperty} to be divided by the Court.`, ['no_property']));
  } else {
    blocks.push(blank('property', `Draft — list the ${maritalProperty} (home, vehicles, accounts, pensions), or confirm in the interview that there is none to divide. Nothing has been assumed.`, 'Property'));
  }

  const debts = listField(file, 'debtItems');
  if (debts) {
    blocks.push(paragraph(`The parties have incurred ${maritalDebts} during the marriage, including the following:`, ['debtItems']));
    blocks.push(list(debts));
    blocks.push(paragraph(`${labels.self} asks the Court to allocate responsibility for the ${maritalDebts} between the parties.`, ['debtItems']));
  } else if (confirmed(file, 'no_debts')) {
    blocks.push(paragraph(`There are no ${maritalDebts} to be allocated by the Court.`, ['no_debts']));
  } else {
    blocks.push(blank('debts', `Draft — list the ${maritalDebts} (mortgage, loans, credit cards), or confirm in the interview that there are none. Nothing has been assumed.`, 'Debts'));
  }

  if (items || debts) blocks.push(...(await ctx.narrative(PROPERTY_SECTION)));
  return section(PROPERTY_SECTION, 'Property and Debts', blocks);
}
