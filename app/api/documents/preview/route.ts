import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import { logger } from '@/lib/logger';
import { readJsonBody } from '@/lib/api/requestBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body schema. `affidavitData` is an opaque blob shaped by the editor; we
 * `.passthrough()` so unknown editor fields propagate without Zod stripping
 * them. The renderer downstream inspects `state`, `county`, `affiantName`,
 * `documentType`, `activeSubDocument`, and `facts`.
 */
const previewSchema = z.object({
  affidavitData: z
    .object({
      state: z.string().optional(),
      county: z.string().optional(),
      affiantName: z.string().optional(),
      documentType: z.string().optional(),
      activeSubDocument: z.string().nullable().optional(),
      facts: z.array(z.unknown()).optional(),
    })
    .passthrough(),
});

type AffidavitData = Record<string, unknown> & {
  state?: string;
  county?: string;
  affiantName?: string;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  activeSubDocument?: string | null;
  facts?: unknown[];
  petitionerName?: string;
  petitionerFirstName?: string;
  petitionerLastName?: string;
  respondentName?: string;
  respondentFirstName?: string;
  respondentLastName?: string;
  caseNumber?: string;
};

// Document type IDs handled by the divorce / dissolution sub-templates. The
// editor uses `divorce_package` as the umbrella type and tracks the active
// sub-document via `activeSubDocument`, but matter orchestrators sometimes
// populate `documentType` with the sub-doc id directly.
const DIVORCE_DOCUMENT_TYPES = new Set([
  'divorce_petition',
  'divorce_decree',
  'petition_dissolution',
  'judgment_dissolution',
  'final_judgment',
  'proposed_judgment',
]);

const STATE_NAMES: Record<string, string> = {
  TX: 'Texas', UT: 'Utah', AZ: 'Arizona', CA: 'California',
  FL: 'Florida', IL: 'Illinois', NY: 'New York',
  ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta',
};

function getStateName(stateCode: string | undefined): string {
  if (!stateCode) return 'Unknown';
  return STATE_NAMES[stateCode.toUpperCase()] || stateCode;
}

function resolveAffiantName(data: AffidavitData): string {
  if (data.affiantName) return data.affiantName;
  const parts = [data.firstName, data.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return '[YOUR NAME]';
}

/**
 * Minimum-viable preview shape used when no state is selected (or template
 * generation fails). Matches the `{ sections: { … } }` contract that
 * `components/app/DocumentPreview.js` paginates, so the user sees a useful
 * placeholder instead of a blank page.
 */
function createFallbackPreview(data: AffidavitData) {
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const affiantName = resolveAffiantName(data);
  const factsItems = facts.map((fact, index) => {
    const f = fact as Record<string, unknown>;
    const content =
      (typeof fact === 'string' ? fact : (f?.professionalRewrite as string) || (f?.content as string)) ||
      '';
    return { number: index + 1, content, type: (f?.type as string) || 'fact' };
  });

  return {
    sections: {
      header: `STATE OF ${getStateName(data.state).toUpperCase()}`,
      venue: `STATE OF ${getStateName(data.state).toUpperCase()}\nCOUNTY OF ${(data.county || '[COUNTY]').toUpperCase()}`,
      title: 'AFFIDAVIT',
      introduction: `I, ${affiantName}, being first duly sworn, depose and state as follows:`,
      facts: {
        items: factsItems.length
          ? factsItems
          : [{ number: 1, content: 'No facts have been added yet — keep chatting to add facts.', type: 'fact' }],
      },
      conclusion: 'The facts stated herein are within my personal knowledge and are true and correct.',
      signatureBlock: {
        formatted: `\n\n_________________________________\n${affiantName}, Affiant`,
      },
      notaryBlock: `NOTARY ACKNOWLEDGMENT\n\nSworn to and subscribed before me this _____ day of _________, ${new Date().getFullYear()}.\n\n\n_________________________________\nNotary Public\n\nMy commission expires: ___________`,
    },
    metadata: {
      fallback: true,
      totalFacts: facts.length,
    },
  };
}

function createDivorceFallbackPreview(data: AffidavitData) {
  const petitionerName =
    data.petitionerName ||
    [data.petitionerFirstName, data.petitionerLastName].filter(Boolean).join(' ') ||
    '[PETITIONER NAME]';
  const respondentName =
    data.respondentName ||
    [data.respondentFirstName, data.respondentLastName].filter(Boolean).join(' ') ||
    '[RESPONDENT NAME]';
  const activeDoc = data.activeSubDocument || 'divorce_petition';
  const docTitle =
    activeDoc === 'divorce_decree' ? 'FINAL DECREE OF DIVORCE' : 'ORIGINAL PETITION FOR DIVORCE';

  return {
    sections: {
      header: `STATE OF ${getStateName(data.state).toUpperCase()}`,
      venue: `COUNTY OF ${(data.county || '[COUNTY]').toUpperCase()}`,
      caseCaption: {
        formatted: `CAUSE NO. ${data.caseNumber || '[CAUSE NUMBER]'}\n\nIN THE MATTER OF THE MARRIAGE OF:\n\n${petitionerName.toUpperCase()}, Petitioner\n\nAND\n\n${respondentName.toUpperCase()}, Respondent`,
      },
      title: docTitle,
      parties: {
        title: 'I. PARTIES',
        items: [
          { number: 1, content: `Petitioner: ${petitionerName}`, type: 'party_identification' },
          { number: 2, content: `Respondent: ${respondentName}`, type: 'party_identification' },
        ],
      },
      jurisdiction: {
        title: 'II. JURISDICTION AND VENUE',
        items: [
          {
            number: 3,
            content: 'Continue providing information through the chat to complete this section.',
            type: 'jurisdiction',
          },
        ],
      },
    },
    metadata: {
      fallback: true,
      documentType: activeDoc,
    },
  };
}

/**
 * Map chat-extracted divorce fields to template-expected field names. Mutates
 * `data` in place. Ported from the legacy `routes/documents.js` so divorce
 * previews resolve the same fields they did pre-Next-migration.
 */
function mapDivorceDataFields(data: AffidavitData): void {
  if (!data.petitionerName && (data.petitionerFirstName || data.petitionerLastName)) {
    data.petitionerName = [data.petitionerFirstName, data.petitionerLastName].filter(Boolean).join(' ');
  }
  if (!data.respondentName && (data.respondentFirstName || data.respondentLastName)) {
    data.respondentName = [data.respondentFirstName, data.respondentLastName].filter(Boolean).join(' ');
  }
}

/**
 * Map matter orchestrator output fields → affidavit template fields, so a
 * matter-typed preview (custody, small_claims, etc.) renders with the same
 * affiantName the chat collected.
 */
function mapMatterDataFields(data: AffidavitData): void {
  if (data.affiantName) return;
  if (data.petitionerName) {
    data.affiantName = data.petitionerName;
    return;
  }
  if (data.petitionerFirstName || data.petitionerLastName) {
    data.affiantName = [data.petitionerFirstName, data.petitionerLastName].filter(Boolean).join(' ');
  }
}

type TemplateManager = {
  hasDocumentType: (state: string, docType: string) => boolean;
  generateAffidavit: (state: string, data: unknown) => { sections: unknown; htmlContent?: string };
  generateDocument: (
    state: string,
    docType: string,
    data: unknown,
  ) => { sections: unknown; htmlContent?: string };
};

/**
 * POST /api/documents/preview
 *
 * Renders a structured preview from the editor's affidavit blob. Returns
 * `{ success, preview: { sections, … }, metadata }` — `DocumentPreview.js`
 * paginates by walking `preview.sections`, so the shape is load-bearing.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let affidavitData: AffidavitData = {};
  try {
    const limit = await checkRateLimit('documents-preview', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = await readJsonBody(req);
    affidavitData = previewSchema.parse(json).affidavitData as AffidavitData;

    const docType = (affidavitData.documentType || 'affidavit').toLowerCase();
    const activeSub = (affidavitData.activeSubDocument || '').toLowerCase();
    const effectiveDocType =
      docType === 'divorce_package' ? activeSub || 'divorce_petition' : docType;
    const isDivorce =
      docType === 'divorce_package' || DIVORCE_DOCUMENT_TYPES.has(effectiveDocType);
    const state = (affidavitData.state || '').toUpperCase();

    // No state yet — use neutral fallback so we don't bias toward a default
    // jurisdiction. Matches legacy preview behaviour.
    if (!state.trim()) {
      const preview = isDivorce
        ? createDivorceFallbackPreview(affidavitData)
        : createFallbackPreview(affidavitData);
      return NextResponse.json({
        success: true,
        preview,
        metadata: { generatedAt: new Date().toISOString(), fallback: true },
      });
    }

    const { templateManager } = (await getServices()) as { templateManager: TemplateManager };

    let document: { sections: unknown; htmlContent?: string } | null = null;

    try {
      if (isDivorce) {
        const divorceData = { ...affidavitData };
        mapDivorceDataFields(divorceData);
        if (templateManager.hasDocumentType(state, effectiveDocType)) {
          document = templateManager.generateDocument(state, effectiveDocType, divorceData);
        }
      } else {
        const matterData = { ...affidavitData };
        if (matterData.matterTypeCode) mapMatterDataFields(matterData);
        document = templateManager.generateAffidavit(state, matterData);
      }
    } catch (renderErr) {
      logger.warn('preview_template_failed', {
        userId: user.id,
        state,
        effectiveDocType,
        error: renderErr instanceof Error ? renderErr.message : String(renderErr),
      });
      document = null;
    }

    if (!document) {
      const preview = isDivorce
        ? createDivorceFallbackPreview(affidavitData)
        : createFallbackPreview(affidavitData);
      return NextResponse.json({
        success: true,
        preview,
        metadata: { generatedAt: new Date().toISOString(), fallback: true },
      });
    }

    const facts = Array.isArray(affidavitData.facts) ? affidavitData.facts : [];

    logger.info('preview_generated', {
      userId: user.id,
      state,
      effectiveDocType,
      factCount: facts.length,
    });

    return NextResponse.json({
      success: true,
      preview: {
        sections: document.sections,
        htmlContent: document.htmlContent,
        metadata: { totalFacts: facts.length },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        factCount: facts.length,
      },
    });
  } catch (err) {
    // Last-resort fallback: never return a blank preview to the client. The
    // pagination logic in DocumentPreview.js needs `preview.sections` to
    // render anything at all, so a 500 produces a permanently-blank pane.
    logger.error('preview_unhandled_error', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof z.ZodError) {
      return toErrorResponse(err);
    }
    return NextResponse.json({
      success: true,
      preview: createFallbackPreview(affidavitData),
      metadata: { generatedAt: new Date().toISOString(), fallback: true, degraded: true },
    });
  }
});
