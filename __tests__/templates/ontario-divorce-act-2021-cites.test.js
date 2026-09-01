/** @jest-environment node */
'use strict';

/**
 * Ontario Divorce Order — post-2021 Divorce Act cite hygiene.
 *
 * The 2021 Divorce Act amendments renumbered parenting provisions:
 *   s.16     best-interests-of-the-child factors
 *   s.16.1   parenting orders (court's authority to make)
 *   s.16.2   parenting time
 *   s.16.3   decision-making responsibility
 *
 * Attorney round-5 (Marcus, ON, 2026-08-30) flagged that the Ontario
 * decree template still cited s.16.1 for decision-making responsibility
 * (should be s.16.3) and s.16.1 for parenting-time schedules (should be
 * s.16.2). This test locks in the corrected cites across the joint,
 * sole, and undecided parenting branches, and confirms best-interests
 * language is anchored to s.16 (not s.16.3).
 */

const OntarioDivorceDecreeTemplate = require('../../templates/states/ontario/DivorceDecreeTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    state: 'ON',
    county: 'Toronto',
    caseNumber: 'FC-24-000123',
    marriageDate: '2010-06-01',
    separationDate: '2023-01-15',
    hasMinorChildren: true,
    children: [{ name: 'Aanya Thompson', birthDate: '2014-03-10' }],
    ...overrides,
  };
}

function fullText(data) {
  const template = new OntarioDivorceDecreeTemplate();
  const doc = template.generateDocument(data);
  return doc.fullText || JSON.stringify(doc);
}

describe('Ontario decree — post-2021 Divorce Act parenting cites', () => {
  test('joint arrangement cites s.16.3 for shared decision-making responsibility', () => {
    const text = fullText(baseData({ custodyType: 'joint' }));
    const clause = text.match(/shared decision-making responsibility[^\n]*/);
    expect(clause).toBeTruthy();
    expect(clause[0]).toMatch(/s\.16\.3/);
    expect(clause[0]).not.toMatch(/s\.16\.1[^0-9]/);
  });

  test('sole arrangement cites s.16.3 for sole decision-making responsibility', () => {
    const text = fullText(
      baseData({
        custodyType: 'sole_petitioner',
        primaryResidence: 'petitioner',
      })
    );
    const clause = text.match(/sole decision-making responsibility[^\n]*/);
    expect(clause).toBeTruthy();
    expect(clause[0]).toMatch(/s\.16\.3/);
    expect(clause[0]).not.toMatch(/s\.16\.1[^0-9]/);
  });

  test('parenting-time schedule (with details) cites s.16.2', () => {
    const details =
      'The children shall be with the Applicant Monday through Friday and with the Respondent every other weekend from Friday 6pm to Sunday 6pm; alternating statutory holidays; two non-consecutive weeks each summer.';
    const text = fullText(
      baseData({
        custodyType: 'joint',
        parentTimeDetails: details,
      })
    );
    expect(text).toMatch(/s\.16\.2 of the Divorce Act/);
    // Parenting time is NOT s.16.1 in the post-2021 Act.
    expect(text).not.toMatch(/pursuant to s\.16\.1 of the Divorce Act that each party shall have parenting time/);
  });

  test('parenting-time schedule (no details) cites s.16.2, not s.16.1', () => {
    const text = fullText(baseData({ custodyType: 'joint' }));
    // Either the s.16.2 cite renders in the parenting-time order OR the
    // "as agreed" boilerplate renders — but the boilerplate must not
    // wrongly cite s.16.1 for parenting time.
    const timeClause = text.match(/parenting time[^.]*Divorce Act[^)]*\)/i);
    if (timeClause) {
      expect(timeClause[0]).not.toMatch(/s\.16\.1/);
    }
  });

  test('best-interests recital anchors to s.16 (not s.16.3)', () => {
    const text = fullText(baseData({ custodyType: 'joint' }));
    expect(text).toMatch(/best interests of the child\(ren\)[^.]*Divorce Act, s\.16\)/);
  });

  test('non-alienation clause anchors to s.16, not s.16.3', () => {
    const text = fullText(baseData({ custodyType: 'joint' }));
    expect(text).toMatch(/alienate the child\(ren\)'s affection[^.]*Divorce Act, s\.16\)/);
    expect(text).not.toMatch(/alienate the child\(ren\)'s affection[^.]*s\.16\.3/);
  });

  test('post-2021 vocabulary — no US "considered the above-entitled cause" opener', () => {
    const text = fullText(baseData({ custodyType: 'joint' }));
    expect(text).not.toMatch(/considered the above-entitled/i);
    expect(text).not.toMatch(/above-entitled and numbered cause/i);
    // Ontario opener replaces it with "Upon reading the Application..."
    expect(text).toMatch(/Upon reading the Application/);
  });
});
