/**
 * v2 document drafting — the CORE_ENGINE=v2 branch of the preview and
 * generate routes. Same request/response contracts as v1: preview returns
 * the keyed `sections` object the editor paginates plus HTML; generate
 * returns PDF bytes. Word output stays on v1 (returns null → route falls
 * through).
 */

import { createHash } from 'node:crypto';
import { toCaseFile, type AffidavitData } from '@/core/adapters/legacy';
import type { CaseFile } from '@/core/model/types';
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

/**
 * Composition cache. A document's tree depends only on the hydrated CaseFile
 * and the kind, so the editor's preview and the download (which arrive
 * seconds apart with identical input) share one composition instead of
 * paying the model twice. In-process, per user, short-lived; a changed
 * record changes the key and misses.
 */
const COMPOSE_CACHE_TTL_MS = 10 * 60 * 1000;
const COMPOSE_CACHE_MAX = 200;

type ComposeCache = Map<string, { at: number; tree: DocumentTree }>;
declare global {
  // eslint-disable-next-line no-var
  var __coreComposeCache: ComposeCache | undefined;
}
// On globalThis so it survives Next's per-request module reloads in dev, the
// same way lib/db.ts keeps its pool and the chat route its orchestrators.
const composeCache: ComposeCache = globalThis.__coreComposeCache ?? (globalThis.__coreComposeCache = new Map());

function cacheKey(userId: number, kind: DocumentKind, file: CaseFile): string {
  // The preview posts without a documentId and the download with one; the
  // record is what determines the document, so neither id nor interview
  // bookkeeping enters the key.
  const { interview: _interview, id: _id, ...stable } = file;
  // Provenance timestamps and turn ids are bookkeeping, not content: the
  // legacy adapter stamps `at: now()` on every conversion, which would make
  // two identical requests hash differently.
  const content = JSON.stringify(stable, (k, v) => (k === 'at' || k === 'turnId' ? undefined : v));
  return createHash('sha256').update(`${userId}|${kind}|${content}`).digest('hex');
}

function cachedTree(key: string): DocumentTree | undefined {
  const hit = composeCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > COMPOSE_CACHE_TTL_MS) {
    composeCache.delete(key);
    return undefined;
  }
  return hit.tree;
}

function remember(key: string, tree: DocumentTree): void {
  if (composeCache.size >= COMPOSE_CACHE_MAX) {
    const oldest = composeCache.keys().next().value;
    if (oldest !== undefined) composeCache.delete(oldest);
  }
  composeCache.set(key, { at: Date.now(), tree });
}

/** Test seam. */
export function clearComposeCache(): void {
  composeCache.clear();
}

async function draftTree({ userId, affidavitData }: DraftInput): Promise<{ tree: DocumentTree; kind: DocumentKind; cached: boolean } | null> {
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
  const key = cacheKey(userId, kind, file);
  const hit = cachedTree(key);
  logger.info('core_compose', { userId, kind, key: key.slice(0, 12), cached: Boolean(hit) });
  if (hit) return { tree: hit, kind, cached: true };
  const tree = await engine.draft(file, kind);
  remember(key, tree);
  return { tree, kind, cached: false };
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
