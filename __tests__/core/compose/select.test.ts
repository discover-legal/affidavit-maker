/**
 * @jest-environment node
 *
 * composer.select() — which documents a case needs. Pure code: no model
 * call is ever made, and every selected document carries a reason.
 */
import { createComposer } from '@/core/compose';
import type { DocumentKind, Selection } from '@/core/compose';
import { ScriptedIntelligence } from '@/core/intelligence/scripted';
import { ON, TX, NY, caseFile, stated, confirmed } from './_helpers';

function selectWith(file: ReturnType<typeof caseFile>, jurisdiction = ON): { selection: Selection; intel: ScriptedIntelligence } {
  const intel = new ScriptedIntelligence(); // nothing scripted: any call would throw
  const composer = createComposer({ intelligence: intel });
  const selection = composer.select({ file, jurisdiction });
  return { selection, intel };
}

describe('composer.select', () => {
  it('is pure: never calls the model', () => {
    const { intel } = selectWith(caseFile({ jurisdiction: 'ON' }), ON);
    expect(intel.calls).toEqual([]);
  });

  it('petitioner divorce starts with the petition and includes the decree and a waiver of service', () => {
    const { selection } = selectWith(caseFile({ jurisdiction: 'ON', role: 'petitioner' }), ON);
    expect(selection.documents[0]).toBe('divorce_petition');
    expect(selection.documents).toContain('divorce_decree');
    expect(selection.documents).toContain('waiver_of_service');
    expect(selection.documents).not.toContain('divorce_answer');
  });

  it('petitioner divorce lists each document once', () => {
    const { selection } = selectWith(caseFile({ jurisdiction: 'TX', role: 'petitioner' }), TX);
    expect(new Set(selection.documents).size).toBe(selection.documents.length);
  });

  it('respondent divorce is the answer only — no proposed final orders bundled', () => {
    const { selection } = selectWith(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
    expect(selection.documents).toEqual<DocumentKind[]>(['divorce_answer']);
  });

  it('respondent selection is the same across jurisdictions', () => {
    for (const j of [TX, NY]) {
      const { selection } = selectWith(caseFile({ jurisdiction: j.code, role: 'respondent' }), j);
      expect(selection.documents).toEqual<DocumentKind[]>(['divorce_answer']);
    }
  });

  it('adds an indigency affidavit when the record says fees cannot be paid', () => {
    const without = selectWith(caseFile({ jurisdiction: 'TX' }), TX).selection;
    expect(without.documents).not.toContain('indigency_affidavit');

    const withIndigency = selectWith(
      caseFile({ jurisdiction: 'TX', fields: { indigencyRequested: stated(true, "I can't afford the filing fee") } }),
      TX,
    ).selection;
    expect(withIndigency.documents).toContain('indigency_affidavit');
  });

  it('a stated false indigency request does not add the affidavit', () => {
    const { selection } = selectWith(
      caseFile({ jurisdiction: 'TX', fields: { indigencyRequested: stated(false, 'I can pay the fee') } }),
      TX,
    );
    expect(selection.documents).not.toContain('indigency_affidavit');
  });

  describe('military status affidavit (TX, children, no waiver path)', () => {
    it('is included while the other party’s service status is unknown (field absent)', () => {
      const { selection } = selectWith(caseFile({ jurisdiction: 'TX' }), TX);
      expect(selection.documents).toContain('military_status_affidavit');
    });

    it('is included when the record says the other party is in service', () => {
      const { selection } = selectWith(
        caseFile({ jurisdiction: 'TX', fields: { otherPartyMilitary: stated(true, 'he is in the Army') } }),
        TX,
      );
      expect(selection.documents).toContain('military_status_affidavit');
    });

    it('is excluded only on an explicit not_military confirmation', () => {
      const { selection } = selectWith(
        caseFile({ jurisdiction: 'TX', confirmations: { not_military: confirmed('he has never been in the military') } }),
        TX,
      );
      expect(selection.documents).not.toContain('military_status_affidavit');
    });

    it('a stated false field alone is not a confirmation — the affidavit stays', () => {
      const { selection } = selectWith(
        caseFile({ jurisdiction: 'TX', fields: { otherPartyMilitary: stated(false, "I don't think so") } }),
        TX,
      );
      expect(selection.documents).toContain('military_status_affidavit');
    });
  });

  it('a non-divorce matter selects the generic affidavit', () => {
    const { selection } = selectWith(caseFile({ jurisdiction: 'ON', matter: 'name_change' }), ON);
    expect(selection.documents).toEqual<DocumentKind[]>(['affidavit']);
  });

  it('a file with no matter selects the generic affidavit', () => {
    const file = caseFile({ jurisdiction: 'ON' });
    delete file.matter;
    const { selection } = selectWith(file, ON);
    expect(selection.documents).toEqual<DocumentKind[]>(['affidavit']);
  });

  it('gives a reason for every selected document, and no reason for an unselected one', () => {
    const cases = [
      selectWith(caseFile({ jurisdiction: 'TX', role: 'petitioner', fields: { indigencyRequested: stated(true) } }), TX),
      selectWith(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON),
      selectWith(caseFile({ jurisdiction: 'NY', matter: 'name_change' }), NY),
    ];
    for (const { selection } of cases) {
      expect(selection.documents.length).toBeGreaterThan(0);
      for (const kind of selection.documents) {
        const reason = selection.reasons[kind];
        expect(typeof reason).toBe('string');
        expect((reason as string).length).toBeGreaterThan(0);
      }
      for (const kind of Object.keys(selection.reasons) as DocumentKind[]) {
        expect(selection.documents).toContain(kind);
      }
    }
  });
});
