/**
 * Caption — court lines, file number and party labels, all from the
 * jurisdiction lexicon and the record. The record's "self" keeps their
 * legal role (a respondent's answer labels them Respondent / Defendant).
 *
 * A missing case number is `fileNumber: undefined` plus a typed blank; a
 * missing county is a typed blank too. Blanks must live in a section so
 * the review screen (tree.blanks) can point at them, so the caption's
 * blanks go in a leading `caption` section that exists only when needed.
 */

import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile } from '../model/types';
import type { Caption, Section } from './types';
import { CASE_NUMBER_ID, COUNTY_ID, blank, labelsFor, partyName, section } from './record';

const COUNTY_TOKEN = '{county}';
const STATE_TOKEN = '{state}';
/** Visible fill-in for a caption line whose county is not on record; the paired blank block carries the note. */
const COUNTY_FILL_IN = '__________';

/** Court header lines with the venue tokens substituted (split/join: plain token substitution, not a regex). */
export function courtLines(file: CaseFile, jurisdiction: JurisdictionProfile): string[] {
  const county = file.county?.value;
  const countyText = typeof county === 'string' && county.length > 0 ? county.toUpperCase() : COUNTY_FILL_IN;
  return jurisdiction.court.venueLines.map((line) => line.split(COUNTY_TOKEN).join(countyText).split(STATE_TOKEN).join(jurisdiction.name.toUpperCase()));
}

export function buildCaption(file: CaseFile, jurisdiction: JurisdictionProfile, title: string): Caption {
  const labels = labelsFor(file, jurisdiction);
  const self = partyName(file, 'self');
  const other = partyName(file, 'other');
  const caseNumber = file.caseNumber?.value;
  const caption: Caption = {
    courtLines: courtLines(file, jurisdiction),
    fileNumberLabel: jurisdiction.lexicon.fileNumberLabel,
    parties: { selfLabel: labels.self, otherLabel: labels.other, versus: jurisdiction.lexicon.versus },
    title,
  };
  if (typeof caseNumber === 'string' && caseNumber.trim().length > 0) caption.fileNumber = caseNumber;
  if (self.name) caption.parties.selfName = self.name;
  if (other.name) caption.parties.otherName = other.name;
  return caption;
}

/** The `caption` section: only the blanks the caption could not fill. Absent when the caption is complete. */
export function captionSection(file: CaseFile, jurisdiction: JurisdictionProfile, caption: Caption): Section | undefined {
  const { lexicon } = jurisdiction;
  const blocks = [];
  // The caption row itself shows the file-number blank; the block below is
  // index-only (renderers skip blanks whose field is the case number in the
  // caption section) so "Court File No." is not printed twice.
  if (caption.fileNumber === undefined) {
    blocks.push(
      blank(
        CASE_NUMBER_ID,
        `Draft — enter the ${lexicon.fileNumberLabel} the court assigned. Leave it blank if this is the first document filed in the case; the clerk assigns the number on filing.`,
        lexicon.fileNumberLabel,
      ),
    );
  }
  if (!file.county) {
    blocks.push(
      blank(
        COUNTY_ID,
        `Draft — state the ${lexicon.countyLabel} where the case will be filed; it sets the court named in the caption.`,
        lexicon.countyLabel,
      ),
    );
  }
  return blocks.length > 0 ? section('caption', undefined, blocks) : undefined;
}
