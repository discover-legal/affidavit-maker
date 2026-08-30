/**
 * Assert Canadian (ON, AB) divorce templates do NOT emit US idioms:
 *   - "IT IS ORDERED AND DECREED"   (US decree phrasing; Canada uses bare "IT IS ORDERED")
 *   - "pro se"                      (US self-representation term; Canada: "Self-Represented")
 *   - "duly cited"                  (US criminal-writ term; Canada: "duly served")
 *   - "state/province" caption      (Canada is province-only)
 */

'use strict';

const OntarioDivorceDecreeTemplate =
  require('../../templates/states/ontario/DivorceDecreeTemplate');
const AlbertaDivorceDecreeTemplate =
  require('../../templates/states/alberta/DivorceDecreeTemplate');
const OntarioDivorcePetitionTemplate =
  require('../../templates/states/ontario/DivorcePetitionTemplate');
const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

const BANNED = [
  /IT IS ORDERED AND DECREED/,
  /\bpro se\b/i,
  /\bduly cited\b/i,
  /\bstate\/province\b/i,
];

function assertClean(fullText) {
  for (const re of BANNED) {
    expect(fullText).not.toMatch(re);
  }
}

const baseCase = {
  petitionerName: 'Priya Thompson',
  respondentName: 'Marcus Thompson',
  county: 'Toronto',
  caseNumber: 'FC-24-000123',
  marriageDate: '2010-06-01',
  separationDate: '2020-05-01',
  hasMinorChildren: true,
  children: [{ name: 'Ava', birthDate: '2016-05-01' }],
  primaryResidence: 'petitioner',
  custodyType: 'joint',
  serviceMethod: 'formal',
  respondentDefaulted: true,
  appearanceType: 'default',
  groundsForDivorce: 'separation',
};

const albertaCase = {
  ...baseCase,
  county: 'Calgary',
  caseNumber: '2401-01234',
};

describe('Canadian idiom purge (ON, AB)', () => {
  test('Ontario Divorce Order does not contain US idioms', () => {
    const doc = new OntarioDivorceDecreeTemplate().generateDocument(baseCase);
    assertClean(doc.fullText);
  });

  test('Alberta Divorce Judgment does not contain US idioms', () => {
    const doc = new AlbertaDivorceDecreeTemplate().generateDocument(albertaCase);
    assertClean(doc.fullText);
  });

  test('Ontario Application does not contain US idioms', () => {
    const doc = new OntarioDivorcePetitionTemplate().generateDocument(baseCase);
    assertClean(doc.fullText);
  });

  test('Alberta Statement of Claim does not contain US idioms', () => {
    const doc = new AlbertaDivorcePetitionTemplate().generateDocument(albertaCase);
    assertClean(doc.fullText);
  });
});
