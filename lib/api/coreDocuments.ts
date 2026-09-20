/**
 * v2 document drafting — the CORE_ENGINE=v2 branch of the preview and
 * generate routes. Same request/response contracts as v1: preview returns
 * the keyed `sections` object the editor paginates plus HTML; generate
 * returns PDF bytes. Word output stays on v1 (returns null → route falls
 * through).
 */

import { toCaseFile, type AffidavitData } from '@/core/adapters/legacy';
import { toLegacyPreview, type LegacySections } from '@/core/adapters/preview';
import type { DocumentKind, DocumentTree } from '@/core/compose/types';
import { getCoreEngine } from '@/lib/api/coreChat';
import { getLifeStory } from '@/lib/api/lifeStoryStore';
import { logger } from '@/lib/logger';

const KIND_BY_TYPE: Record<string, DocumentKind> = {
  affidavit: 'affidavit',
  general_affidavit: 'affidavit',
  divorce_petition: 'divorce_petition',
  divorce_decree: 'divorce_decree',
  divorce_response: 'divorce_answer',
  divorce_answer: 'divorce_answer',
  waiver_of_service: 'waiver_of_service',
  prove_up_affidavit: 'prove_up_affidavit',
  military_status_affidavit: 'military_status_affidavit',
  indigency_affidavit: 'indigency_affidavit',
  cert_last_known_address: 'cert_last_known_address',
  lawyer_handoff_summary: 'lawyer_handoff_summary',
};

/** The document the caller wants, resolved the way the v1 routes do (package → active sub-document). */
export function resolveDocumentKind(affidavitData: AffidavitData): DocumentKind {
  const docType = String(affidavitData.documentType ?? 'affidavit').toLowerCase();
  const active = String(affidavitData.activeSubDocument ?? '').toLowerCase();
  const effective = docType === 'divorce_package' ? active || (affidavitData.role === 'respondent' ? 'divorce_response' : 'divorce_petition') : docType;
  return KIND_BY_TYPE[effective] ?? 'affidavit';
}

export interface DraftInput {
  userId: number;
  affidavitData: AffidavitData;
}

async function draftTree({ userId, affidavitData }: DraftInput): Promise<{ tree: DocumentTree; kind: DocumentKind } | null> {
  const state = String(affidavitData.state ?? '').trim();
  if (!state) return null;
  const engine = getCoreEngine();
  const kind = resolveDocumentKind(affidavitData);
  let file = toCaseFile(affidavitData, { id: String(affidavitData.documentId ?? 'preview'), userId: String(userId) });
  try {
    const story = await getLifeStory(userId);
    const definition = file.matter ? engine.matters.get(file.matter, file.jurisdiction) : null;
    file = engine.lifeStory.hydrate(story, file, definition?.familyProfile ? 'family' : 'general');
  } catch (err) {
    logger.warn('life_story_read_failed', { userId, error: (err as Error).message });
  }
  const tree = await engine.draft(file, kind);
  return { tree, kind };
}

export async function draftPreview(input: DraftInput): Promise<{ sections: LegacySections; htmlContent: string; blanks: DocumentTree['blanks']; kind: DocumentKind } | null> {
  const drafted = await draftTree(input);
  if (!drafted) return null;
  const engine = getCoreEngine();
  return {
    sections: toLegacyPreview(drafted.tree),
    htmlContent: engine.renderer.html(drafted.tree, { draftBanner: true }),
    blanks: drafted.tree.blanks,
    kind: drafted.kind,
  };
}

export async function draftPdf(input: DraftInput): Promise<{ buffer: Buffer; kind: DocumentKind; prefix: string } | null> {
  const drafted = await draftTree(input);
  if (!drafted) return null;
  const engine = getCoreEngine();
  const buffer = await engine.renderer.pdf(drafted.tree, { draftBanner: true, footerBrand: 'Created with Discover.Legal' });
  return { buffer, kind: drafted.kind, prefix: PREFIX_BY_KIND[drafted.kind] };
}

const PREFIX_BY_KIND: Record<DocumentKind, string> = {
  affidavit: 'affidavit',
  divorce_petition: 'petition',
  divorce_decree: 'decree',
  divorce_answer: 'response',
  waiver_of_service: 'waiver-of-service',
  prove_up_affidavit: 'prove-up-affidavit',
  military_status_affidavit: 'military-status-affidavit',
  indigency_affidavit: 'indigency-affidavit',
  cert_last_known_address: 'cert-last-known-address',
  lawyer_handoff_summary: 'lawyer-handoff-summary',
};
