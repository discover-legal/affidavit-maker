/**
 * Marriage — when and where the parties married and when they separated.
 * Dates render only with an ISO / partial-ISO shape (spec 03 §3 I-5); a
 * prose "date" is a blank with a note, and its field id is never cited.
 */

import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { formatDate } from '../dates';
import { blank, dateField, paragraph, section, stringField } from '../record';

export const MARRIAGE_SECTION = 'marriage';

export function marriageSection(ctx: DivorceContext): Section {
  const { file, language } = ctx;
  const blocks: Block[] = [];

  const marriageDate = dateField(file, 'marriageDate');
  const marriagePlace = stringField(file, 'marriagePlace');
  if (marriageDate) {
    const ids = ['marriageDate'];
    let text = `The parties were married on ${formatDate(marriageDate, language)}`;
    if (marriagePlace) {
      text += ` in ${marriagePlace}`;
      ids.push('marriagePlace');
    }
    blocks.push(paragraph(`${text}.`, ids));
  } else {
    blocks.push(blank('marriageDate', 'Draft — state the date of the marriage as it appears on the marriage certificate (year, month and day).', 'Date of marriage', 'The parties were married on ___.'));
    if (marriagePlace) blocks.push(paragraph(`The parties were married in ${marriagePlace}.`, ['marriagePlace']));
    else blocks.push(blank('marriagePlace', 'Draft — state the city and country where the marriage took place.', 'Place of marriage', 'The parties were married at ___.'));
  }

  const separationDate = dateField(file, 'separationDate');
  if (separationDate) {
    blocks.push(paragraph(`The parties separated on ${formatDate(separationDate, language)} and have lived separate and apart since that date.`, ['separationDate']));
  } else if (file.fields.separationDate !== undefined) {
    // Present but not date-shaped: the value stays out of the draft (I-5).
    blocks.push(blank('separationDate', 'Draft — state the date the parties separated (year, month and day). A description such as "a few months ago" cannot be pleaded.', 'Date of separation', 'The parties separated on ___ and have lived separate and apart since that date.'));
  }

  return section(MARRIAGE_SECTION, 'The Marriage', blocks);
}
