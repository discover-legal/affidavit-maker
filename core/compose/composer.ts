/**
 * The Composer: select → compose → verify.
 *
 * compose() assembles one DocumentTree for a kind: caption from the
 * lexicon and record, the family's fixed sections in order (structural
 * paragraphs built in code from typed values with provenance; narrative
 * paragraphs from one model ask per section, verified before they are
 * spliced in), framing, and the blank index mirrored from the sections.
 */

import type { Intelligence } from '../intelligence/types';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile } from '../model/types';
import type { Composer, ComposerDeps, DocumentKind, DocumentTree, Section, SelectionInput } from './types';
import { buildCaption, captionSection } from './caption';
import { contextFor, divorceContext } from './context';
import type { ComposeContext } from './context';
import { framingFor } from './framing';
import { select } from './select';
import { conclusionSection, factsSection, introductionSection } from './sections/affidavit';
import { admissionsSection, claimSection, defensesSection } from './sections/answer';
import { childrenSection } from './sections/children';
import { appearancesSection, decreeChildrenSection, decreePropertySection, decreeSupportSection, dissolutionSection, findingsSection, judgmentSection } from './sections/decree';
import { groundsSection } from './sections/grounds';
import { marriageSection } from './sections/marriage';
import { partiesSection } from './sections/parties';
import { propertySection } from './sections/property';
import { reliefSection } from './sections/relief';
import { residencySection } from './sections/residency';
import { supportSection } from './sections/support';
import { handoffSections, indigencySections, lastKnownAddressSections, militarySections, proveUpSections, waiverSections } from './sections/supporting';
import { verificationSection } from './sections/verification';
import { indexBlanks, verifyTree } from './verify';

/** Titles for the kinds the divorce profile does not name. */
const GENERIC_TITLES: Partial<Record<DocumentKind, string>> = {
  affidavit: 'AFFIDAVIT',
  waiver_of_service: 'WAIVER OF SERVICE',
  prove_up_affidavit: 'PROVE-UP AFFIDAVIT',
  military_status_affidavit: 'AFFIDAVIT OF MILITARY STATUS',
  indigency_affidavit: 'AFFIDAVIT OF INABILITY TO PAY COSTS',
  cert_last_known_address: 'CERTIFICATE OF LAST KNOWN ADDRESS',
  lawyer_handoff_summary: 'CASE SUMMARY FOR ATTORNEY REVIEW',
};

function titleFor(kind: DocumentKind, jurisdiction: JurisdictionProfile): string {
  const instrument = jurisdiction.divorce?.instrument;
  switch (kind) {
    case 'divorce_petition':
      return instrument?.petition ?? 'PETITION FOR DIVORCE';
    case 'divorce_decree':
      return instrument?.decree ?? 'DECREE OF DIVORCE';
    case 'divorce_answer':
      return instrument?.answer ?? 'ANSWER';
    default:
      return GENERIC_TITLES[kind] ?? kind.toUpperCase();
  }
}

/** The body sections of each document family, in their fixed order. */
async function bodySections(ctx: ComposeContext, kind: DocumentKind): Promise<Section[]> {
  switch (kind) {
    case 'divorce_petition': {
      const d = divorceContext(ctx);
      return [
        partiesSection(d),
        await residencySection(d),
        marriageSection(d),
        await groundsSection(d),
        await childrenSection(d),
        await propertySection(d),
        supportSection(d),
        reliefSection(d),
        verificationSection(d, d.divorce.instrument.petition),
      ];
    }
    case 'divorce_answer': {
      const d = divorceContext(ctx);
      return [admissionsSection(d), defensesSection(d), claimSection(d), verificationSection(d, d.divorce.instrument.answer)];
    }
    case 'divorce_decree': {
      const d = divorceContext(ctx);
      return [appearancesSection(d), findingsSection(d), dissolutionSection(d), decreeChildrenSection(d), decreePropertySection(d), decreeSupportSection(d), judgmentSection()];
    }
    case 'affidavit':
      return [introductionSection(ctx), factsSection(ctx), conclusionSection(), verificationSection(ctx, 'affidavit')];
    case 'waiver_of_service':
      return waiverSections(divorceContext(ctx));
    case 'prove_up_affidavit':
      return proveUpSections(divorceContext(ctx));
    case 'military_status_affidavit':
      return militarySections(divorceContext(ctx));
    case 'indigency_affidavit':
      return indigencySections(ctx);
    case 'cert_last_known_address':
      return lastKnownAddressSections(divorceContext(ctx));
    case 'lawyer_handoff_summary':
      return handoffSections(ctx);
  }
}

async function composeTree(intelligence: Intelligence, input: SelectionInput & { kind: DocumentKind }): Promise<DocumentTree> {
  const { file, jurisdiction, kind } = input;
  const ctx = contextFor(intelligence, file, jurisdiction);
  const caption = buildCaption(file, jurisdiction, titleFor(kind, jurisdiction));
  const lead = captionSection(file, jurisdiction, caption);
  const sections = [...(lead ? [lead] : []), ...(await bodySections(ctx, kind))];
  return {
    kind,
    jurisdiction: jurisdiction.code,
    language: ctx.language,
    paper: jurisdiction.paper,
    caption,
    sections,
    framing: framingFor(file, jurisdiction, kind),
    blanks: indexBlanks(sections),
  };
}

export function createComposer({ intelligence }: ComposerDeps): Composer {
  return {
    select,
    compose: (input) => composeTree(intelligence, input),
    verify: (tree: DocumentTree, file: CaseFile) => verifyTree(intelligence, tree, file),
  };
}
