/**
 * @jest-environment node
 *
 * Attorney round-4 (Tavita FL, 2026-08-30). A respondent generating a
 * divorce_petition — even on the standalone /generate path — is producing
 * a REFERENCE copy of the opposing party's initiating pleading. The
 * REFERENCE — NOT FOR FILING banner must render, and metadata must
 * mark the structure as reference.
 */

import { packetRenderContextFor, buildDocumentStructure } from '@/lib/api/documentStructure';

describe('packetRenderContextFor respondent + petition', () => {
  test('respondent + divorce_petition → reference', () => {
    expect(packetRenderContextFor('respondent', 'divorce_petition')).toBe('reference');
    expect(packetRenderContextFor('defendant', 'divorce_petition')).toBe('reference');
  });

  test('respondent + divorce_decree → reference (unchanged)', () => {
    expect(packetRenderContextFor('respondent', 'divorce_decree')).toBe('reference');
  });

  test('petitioner + divorce_petition → filing', () => {
    expect(packetRenderContextFor('petitioner', 'divorce_petition')).toBe('filing');
    expect(packetRenderContextFor('applicant', 'divorce_petition')).toBe('filing');
    expect(packetRenderContextFor(null, 'divorce_petition')).toBe('filing');
  });

  test('respondent + divorce_response → filing (Answer IS filed by respondent)', () => {
    expect(packetRenderContextFor('respondent', 'divorce_response')).toBe('filing');
  });
});

describe('buildDocumentStructure marks respondent-petition builds as reference', () => {
  test('respondent + divorce_petition → renderContext=reference + REFERENCE banner', () => {
    const templateManager = {
      hasDocumentType: () => true,
      generateDivorcePetition: (_state: string, _data: unknown) => ({
        sections: { header: 'IN THE CIRCUIT COURT' },
      }),
    } as unknown as Parameters<typeof buildDocumentStructure>[0];
    const built = buildDocumentStructure(templateManager, 'FL', {
      state: 'FL',
      role: 'respondent',
      documentType: 'divorce_petition',
    } as never) as { renderContext?: string; sections?: { header?: string }; metadata?: { renderContext?: string } };
    expect(built.renderContext).toBe('reference');
    expect(built.metadata?.renderContext).toBe('reference');
    expect(built.sections?.header).toMatch(/REFERENCE — NOT FOR FILING/);
  });
});
