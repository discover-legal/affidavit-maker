/**
 * What every section builder receives: the record, the jurisdiction's
 * divorce profile, the role labels, and a way to request verified
 * narrative for a section. Builders are small pure functions over this;
 * the only async part is the narrative request.
 */

import type { Intelligence } from '../intelligence/types';
import type { DivorceProfile, JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile, Language } from '../model/types';
import type { Block } from './types';
import { narrativeFor } from './narrative';
import { labelsFor, languageOf } from './record';
import type { Labels } from './record';

export interface ComposeContext {
  file: CaseFile;
  jurisdiction: JurisdictionProfile;
  labels: Labels;
  language: Language;
  /** Verified narrative blocks (paragraphs / blanks) for a section, from ONE model ask. */
  narrative(sectionId: string): Promise<Block[]>;
}

export interface DivorceContext extends ComposeContext {
  divorce: DivorceProfile;
}

export function contextFor(intelligence: Intelligence, file: CaseFile, jurisdiction: JurisdictionProfile): ComposeContext {
  return {
    file,
    jurisdiction,
    labels: labelsFor(file, jurisdiction),
    language: languageOf(file),
    narrative: (sectionId) => narrativeFor({ intelligence, file, jurisdiction }, sectionId),
  };
}

export function divorceContext(ctx: ComposeContext): DivorceContext {
  const { divorce } = ctx.jurisdiction;
  if (!divorce) throw new Error(`compose: jurisdiction ${ctx.jurisdiction.code} has no divorce profile`);
  return { ...ctx, divorce };
}
