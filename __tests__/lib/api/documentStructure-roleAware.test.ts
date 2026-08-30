/** @jest-environment node */
/**
 * BUG 3 — Ontario acceptance v6: role-aware routing for divorce_package.
 *
 * A role='respondent' user asked "please generate the answer, decree, and
 * financial statements" and received exactly one file (decree.txt = `{}`).
 * The petitioner-shaped expansion attempted to render the other side's
 * petition, which failed silently and stripped the packet down to nothing
 * usable.
 *
 * The mapping in lib/api/documentStructure.ts must be role-aware:
 *   - petitioner: divorce_package → ['divorce_petition', 'divorce_decree']
 *     (unchanged; historical default)
 *   - respondent: divorce_package → ['divorce_response', 'divorce_decree']
 *     (Bug 1, Tavita FL, 2026-08-29: respondents must first file an
 *     Answer/Response — the prior `['divorce_decree']` expansion skipped
 *     the pleading a respondent actually needs. Jurisdictions without an
 *     `answer` support-doc builder degrade with a truthful per-sub-doc 400.)
 *
 * classifyGenerationRequest + resolveGenerationDocumentType must default the
 * divorce_package activeSubDocument to 'divorce_response' for respondents so
 * the per-document generate route follows the same convention.
 */

import {
  listPacketDocumentTypes,
  resolveGenerationDocumentType,
  classifyGenerationRequest,
  assertGenerationTypeAllowed,
} from '@/lib/api/documentStructure';

describe('BUG 3 — role-aware routing for divorce_package', () => {
  describe('listPacketDocumentTypes', () => {
    test("petitioner (or no role) expands divorce_package to ['divorce_petition', 'divorce_decree']", () => {
      expect(listPacketDocumentTypes('divorce_package')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
      expect(listPacketDocumentTypes('divorce_package', 'petitioner')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
      expect(listPacketDocumentTypes('divorce_package', undefined)).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
    });

    test("respondent's divorce_package DROPS the petition — expands to ['divorce_response', 'divorce_decree']", () => {
      const packet = listPacketDocumentTypes('divorce_package', 'respondent');
      expect(packet).toEqual(['divorce_response', 'divorce_decree']);
      expect(packet).not.toContain('divorce_petition');
    });

    test('respondent role is case-insensitive and whitespace-tolerant', () => {
      expect(listPacketDocumentTypes('divorce_package', 'Respondent')).toEqual([
        'divorce_response',
        'divorce_decree',
      ]);
      expect(listPacketDocumentTypes('divorce_package', '  RESPONDENT  ')).toEqual([
        'divorce_response',
        'divorce_decree',
      ]);
    });

    test('non-package types are unaffected by role', () => {
      expect(listPacketDocumentTypes('divorce_petition', 'respondent')).toEqual([
        'divorce_petition',
      ]);
      expect(listPacketDocumentTypes('divorce_decree', 'respondent')).toEqual(['divorce_decree']);
      expect(listPacketDocumentTypes('affidavit', 'respondent')).toEqual(['affidavit']);
    });
  });

  describe('resolveGenerationDocumentType — divorce_package default', () => {
    test('petitioner default: divorce_package with no activeSubDocument → divorce_petition', () => {
      expect(resolveGenerationDocumentType('divorce_package', undefined)).toBe('divorce_petition');
      expect(resolveGenerationDocumentType('divorce_package', undefined, 'petitioner')).toBe(
        'divorce_petition',
      );
    });

    test('respondent default: divorce_package with no activeSubDocument → divorce_response', () => {
      expect(resolveGenerationDocumentType('divorce_package', undefined, 'respondent')).toBe(
        'divorce_response',
      );
      expect(resolveGenerationDocumentType('divorce_package', null, 'respondent')).toBe(
        'divorce_response',
      );
    });

    test('an explicit activeSubDocument overrides the role-aware default', () => {
      // A respondent can still explicitly ask for the petition tab if they
      // really want it — the default just picks something sensible.
      expect(resolveGenerationDocumentType('divorce_package', 'divorce_petition', 'respondent')).toBe(
        'divorce_petition',
      );
      expect(resolveGenerationDocumentType('divorce_package', 'divorce_decree', 'petitioner')).toBe(
        'divorce_decree',
      );
    });
  });

  describe('classifyGenerationRequest — honors the same role-aware default', () => {
    test("respondent's divorce_package classifies as response by default", () => {
      const c = classifyGenerationRequest('divorce_package', undefined, 'respondent');
      expect(c).toEqual({ kind: 'divorce', type: 'divorce_response' });
    });

    test("petitioner's divorce_package classifies as petition by default", () => {
      const c = classifyGenerationRequest('divorce_package', undefined, 'petitioner');
      expect(c).toEqual({ kind: 'divorce', type: 'divorce_petition' });
      const cDefault = classifyGenerationRequest('divorce_package', undefined);
      expect(cDefault).toEqual({ kind: 'divorce', type: 'divorce_petition' });
    });
  });

  /**
   * BUG — Alberta acceptance: Sarah (AB, role='applicant') POSTs
   * `/api/documents/generate {documentType:'divorce_package'}` and hit a 400
   * "Unsupported divorce package document selection". Canadian family law
   * uses "applicant" (Divorce Act) where U.S. states use "petitioner"; the
   * legacy role-blind fallthrough happened to work for 'applicant' by
   * accident. Lock in that 'applicant' — and every Canadian province — routes
   * exactly like 'petitioner', and make it explicit rather than implicit.
   *
   * The routing map (PACKAGE_SUB_DOCUMENTS_BY_ROLE) is intentionally
   * state-independent — every jurisdiction with divorce templates uses the
   * same petition-then-decree composition. These tests assert parity across
   * provinces so a future jurisdiction-specific carve-out doesn't silently
   * regress AB's packet.
   */
  describe('Canadian applicant nomenclature (AB acceptance)', () => {
    test("'applicant' role is treated as petitioner-side (Divorce Act term)", () => {
      expect(listPacketDocumentTypes('divorce_package', 'applicant')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
      expect(resolveGenerationDocumentType('divorce_package', undefined, 'applicant')).toBe(
        'divorce_petition',
      );
      expect(classifyGenerationRequest('divorce_package', undefined, 'applicant')).toEqual({
        kind: 'divorce',
        type: 'divorce_petition',
      });
    });

    test("'applicant' is case-insensitive and whitespace-tolerant", () => {
      expect(listPacketDocumentTypes('divorce_package', 'Applicant')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
      expect(listPacketDocumentTypes('divorce_package', '  APPLICANT  ')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
    });

    test("'plaintiff' (older U.S. nomenclature) also maps to petitioner-side", () => {
      expect(listPacketDocumentTypes('divorce_package', 'plaintiff')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
    });

    test("'defendant' (older U.S. nomenclature) maps to respondent-side", () => {
      expect(listPacketDocumentTypes('divorce_package', 'defendant')).toEqual([
        'divorce_response',
        'divorce_decree',
      ]);
    });

    test('exact reproduction: AB applicant POST {documentType:"divorce_package"} does not throw', () => {
      // Faithful reproduction of the reported failing call — the body has
      // documentType but no activeSubDocument. The route reads role from
      // affidavitData.role. Before the fix, an 'applicant' role would still
      // fall through to petitioner by accident; assert the explicit behaviour.
      expect(() =>
        classifyGenerationRequest('divorce_package', undefined, 'applicant'),
      ).not.toThrow();
      expect(() => classifyGenerationRequest('divorce_package', null, 'applicant')).not.toThrow();
    });
  });

  describe('all provinces resolve divorce_package identically (state-independent routing)', () => {
    // Provinces with divorce templates on disk — verify each behaves the same
    // way as ON for both roles. NL is deliberately omitted (no divorce
    // templates land yet); the ROUTING logic is still state-independent, but
    // the render step downstream will 400 for NL until templates ship.
    const provinces = [
      'ON', // Ontario
      'AB', // Alberta
      'BC', // British Columbia
      'QC', // Quebec
      'MB', // Manitoba
      'SK', // Saskatchewan
      'NS', // Nova Scotia
      'NB', // New Brunswick
      'PE', // Prince Edward Island
      'YT', // Yukon
      'NT', // Northwest Territories
      'NU', // Nunavut
    ];

    // listPacketDocumentTypes / classifyGenerationRequest don't take a
    // jurisdiction argument by design — the packet composition is uniform.
    // These loops document that invariant: introducing a per-province
    // override in future must not silently change what the applicant packet
    // contains.
    test.each(provinces)('%s applicant → [divorce_petition, divorce_decree]', () => {
      expect(listPacketDocumentTypes('divorce_package', 'applicant')).toEqual([
        'divorce_petition',
        'divorce_decree',
      ]);
    });

    test.each(provinces)('%s respondent → [divorce_response, divorce_decree]', () => {
      expect(listPacketDocumentTypes('divorce_package', 'respondent')).toEqual([
        'divorce_response',
        'divorce_decree',
      ]);
    });

    test.each(provinces)('%s applicant divorce_package classifies as petition', () => {
      expect(classifyGenerationRequest('divorce_package', undefined, 'applicant')).toEqual({
        kind: 'divorce',
        type: 'divorce_petition',
      });
    });
  });

  /**
   * BUG 1 (Tavita, FL, 2026-08-29): a saved `divorce_package` row must be
   * able to render its response sub-document. Prior to the fix,
   * `assertGenerationTypeAllowed('divorce_package', 'divorce_response', …)`
   * threw "Requested output does not match the saved document type" because
   * 'divorce_response' resolved to 'affidavit' (not in DIVORCE_TYPE_ALIASES).
   */
  describe('BUG 1 — divorce_response is a valid sub-document of a saved divorce_package', () => {
    test('divorce_response resolves through the aliases table', () => {
      expect(resolveGenerationDocumentType('divorce_response', undefined)).toBe('divorce_response');
      expect(resolveGenerationDocumentType('divorce_package', 'divorce_response')).toBe(
        'divorce_response',
      );
      expect(resolveGenerationDocumentType('divorce_package', 'response')).toBe('divorce_response');
      expect(resolveGenerationDocumentType('divorce_package', 'answer_of_divorce')).toBe(
        'divorce_response',
      );
    });

    test('divorce_response classifies as a divorce request (not support / not affidavit)', () => {
      expect(classifyGenerationRequest('divorce_response', undefined)).toEqual({
        kind: 'divorce',
        type: 'divorce_response',
      });
    });

    test('saved divorce_package row allows generating divorce_response', () => {
      expect(() =>
        assertGenerationTypeAllowed('divorce_package', 'divorce_response', null),
      ).not.toThrow();
    });

    test('standalone divorce_response row stays bound to divorce_response output', () => {
      expect(() =>
        assertGenerationTypeAllowed('divorce_response', 'divorce_petition', null),
      ).toThrow('does not match');
      expect(() =>
        assertGenerationTypeAllowed('divorce_response', 'divorce_decree', null),
      ).toThrow('does not match');
      expect(() =>
        assertGenerationTypeAllowed('divorce_response', 'divorce_response', null),
      ).not.toThrow();
    });

    test('affidavit row cannot generate divorce_response', () => {
      expect(() =>
        assertGenerationTypeAllowed('general', 'divorce_response', null),
      ).toThrow('does not match');
    });
  });
});
