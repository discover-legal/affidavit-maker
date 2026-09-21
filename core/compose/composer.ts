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
import type { Block, Composer, ComposerDeps, DocumentKind, DocumentTree, Section, SelectionInput } from './types';
import { buildCaption, captionSection } from './caption';
import { narrativeForDocument } from './narrative';
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
function bodySections(ctx: ComposeContext, kind: DocumentKind): Section[] {
  switch (kind) {
    case 'divorce_petition': {
      const d = divorceContext(ctx);
      return [
        partiesSection(d),
        residencySection(d),
        marriageSection(d),
        groundsSection(d),
        childrenSection(d),
        propertySection(d),
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

/** Sections whose facts the model may expand on; the rest are structure only. */
const NARRATIVE_SECTIONS = new Set(['residency', 'grounds', 'children', 'property']);

async function composeTree(intelligence: Intelligence, input: SelectionInput & { kind: DocumentKind }): Promise<DocumentTree> {
  const { file, jurisdiction, kind } = input;
  const ctx = contextFor(file, jurisdiction);
  const caption = buildCaption(file, jurisdiction, titleFor(kind, jurisdiction));
  const lead = captionSection(file, jurisdiction, caption);
  // Phase 1: every section from typed values, no model. Phase 2: ONE
  // narrative ask over the whole document, verified concurrently, spliced
  // to the end of the section each addition belongs to.
  const structural = [...(lead ? [lead] : []), ...bodySections(ctx, kind)];
  // Eligible: a narrative section that is not closed by a legal gate. The
  // grounds gate (separation too short, unknown ground, no separation date)
  // renders a `grounds` blank and nothing may be pleaded around it; a
  // missing residency figure or property list is a blank the model may
  // still add stated facts beside.
  const gated = (s: Section) => s.id === 'grounds' && s.blocks.some((b) => b.kind === 'blank' && b.field === 'grounds');
  const eligible = structural.filter((s) => NARRATIVE_SECTIONS.has(s.id) && !gated(s));
  const additions = eligible.length > 0 ? await narrativeForDocument({ intelligence, file, jurisdiction }, structural) : new Map<string, Block[]>();
  const eligibleIds = new Set(eligible.map((s) => s.id));
  const sections = structural.map((s) => {
    const extra = additions.get(s.id);
    // A section the record could not fill (a gated ground, an unstated
    // property list) is a blank on purpose; the model may not fill it.
    if (!extra || extra.length === 0 || !eligibleIds.has(s.id)) return s;
    // Keep trailing blanks / notes last: additions go before them.
    const idx = s.blocks.findIndex((b, i) => i > 0 && (b.kind === 'blank' || b.kind === 'note') && s.blocks.slice(i).every((t) => t.kind === 'blank' || t.kind === 'note'));
    const at = idx === -1 ? s.blocks.length : idx;
    return { ...s, blocks: [...s.blocks.slice(0, at), ...extra, ...s.blocks.slice(at)] };
  });
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
