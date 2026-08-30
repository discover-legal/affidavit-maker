/** @jest-environment node */
// Substantive-content tests for the Florida Answer builder. The template
// shell that only emitted a single "Respondent responds to the numbered
// paragraphs … ____" placeholder was rejected on attorney review because
// Fla. Fam. L.R.P. 12.110 / Fla. R. Civ. P. 1.110(c) require per-paragraph
// admit/deny/without-knowledge responses, and Rule 1.110(e) deems every
// unanswered allegation admitted. This suite locks in the pieces the
// rebuilt builder must produce:
//
//   - a general-denial paragraph anchoring the pleading
//   - a per-paragraph scaffold covering the standard divorce-petition
//     allegations (at least 8 numbered items) when the user has not
//     classified paragraphs individually
//   - an affirmative-defenses block, auto-populated with a prenup defense
//     when the profile records `prenupSigned: true` (Rule 1.140(b)/(h)
//     waives affirmative defenses not raised in the responsive pleading)
//   - a counter-petition offer citing Fla. Fam. L.R.P. Form 12.903(b)
//   - certificate of service
//   - Florida verification per Fla. Fam. L.R.P. 12.020(b) / Fla. Stat.
//     § 92.525 (unsworn declaration is FL's equivalent to sworn
//     verification)
//
// A parallel block extends the same guarantees to the CA, GA, NY, TX, ON,
// AB Answer builders that share BaseAnswerTemplate.

const { answerToPetition: flAnswer } = require('../../../services/supportDocs/floridaAnswer');
const { answerToPetition: caAnswer } = require('../../../services/supportDocs/californiaAnswer');
const { answerToPetition: gaAnswer } = require('../../../services/supportDocs/georgiaAnswer');
const { answerToPetition: nyAnswer } = require('../../../services/supportDocs/newyorkAnswer');
const { answerToPetition: txAnswer } = require('../../../services/supportDocs/texasAnswer');
const { answerToPetition: onAnswer } = require('../../../services/supportDocs/ontarioAnswer');
const { answerToPetition: abAnswer } = require('../../../services/supportDocs/albertaAnswer');

const baseFacts = {
  role: 'respondent',
  petitionerName: 'Solomone Kata',
  respondentName: 'Tavita Kata',
  county: 'Duval',
  caseNumber: '2026-DR-01234',
  marriageDate: '2018-03-15',
  marriageLocation: 'Miami, Florida',
  separationDate: '2025-08-01',
};

function itemContents(structure) {
  return structure.sections.facts.items.map((i) => i.content);
}

function textOf(structure) {
  return [
    structure.sections.header,
    structure.sections.title,
    structure.sections.introduction,
    itemContents(structure).join('\n'),
    structure.sections.conclusion,
    structure.sections.perjuryStatement,
  ]
    .filter(Boolean)
    .join('\n');
}

describe('Florida Answer — substantive contents (Fla. Fam. L.R.P. 12.110)', () => {
  test('includes an unmistakable general-denial paragraph', () => {
    const structure = flAnswer(baseFacts);
    const items = structure.sections.facts.items;
    // Round-2 attorney fix: heading and body are now distinct items so the
    // heading doesn't consume a numbered paragraph slot.
    const header = items.find(
      (i) => i.type === 'section_header' && /GENERAL DENIAL/.test(i.content),
    );
    expect(header).toBeDefined();
    const denials = items.filter((i) => i.type === 'general_denial');
    expect(denials.length).toBe(1);
    expect(denials[0].content).toMatch(/Respondent denies each and every allegation/);
  });

  test('emits a per-paragraph admit/deny/without-knowledge scaffold with at least 8 topics', () => {
    const structure = flAnswer(baseFacts);
    const positions = structure.sections.facts.items.filter((i) => i.type === 'answer_position');
    expect(positions.length).toBeGreaterThanOrEqual(8);
    for (const item of positions) {
      // Each scaffold item must offer all three classifications so the user
      // marks one instead of getting an auto-admit or auto-deny (UPL guard).
      expect(item.content).toMatch(/ADMITS/);
      expect(item.content).toMatch(/DENIES/);
      expect(item.content).toMatch(/WITHOUT KNOWLEDGE/);
      expect(item.content).toMatch(/mark one/);
    }
    // Substantive coverage — the standard divorce-petition topic set.
    const combined = positions.map((i) => i.content).join('\n');
    for (const topic of [
      "jurisdiction",
      'residency',
      'marriage',
      'separation',
      'irretrievable breakdown',
      'minor children',
      'marital assets',
      'marital debts',
      'spousal support',
      "attorney's fees",
    ]) {
      expect(combined).toMatch(new RegExp(topic, 'i'));
    }
  });

  test('renders the prenup affirmative defense when prenupSigned=true', () => {
    const structure = flAnswer({ ...baseFacts, prenupSigned: true, prenupYear: '2018' });
    const defenses = structure.sections.facts.items.filter(
      (i) => i.type === 'affirmative_defense',
    );
    expect(defenses.length).toBeGreaterThan(0);
    const prenup = defenses.find((d) => /PRENUPTIAL AGREEMENT/.test(d.content));
    expect(prenup).toBeDefined();
    expect(prenup.content).toMatch(/dated 2018/);
    // FL-specific prenup defense (round-2 override) uses
    // "governs property division"; the generic base template uses
    // "governs the disposition of property". Either wording is fine — the
    // substantive requirement is that the agreement's governance of property
    // is asserted.
    expect(prenup.content).toMatch(/governs (?:the disposition of )?propert/i);
    expect(prenup.content).toMatch(/barred/);
    // And the section header item is present so the block is unmistakable.
    // Round-2 fix: 'AFFIRMATIVE DEFENSES' now sits in a distinct
    // section_header item ahead of the affirmative_defenses_intro body.
    const header = structure.sections.facts.items.find(
      (i) => i.type === 'section_header' && /AFFIRMATIVE DEFENSES/.test(i.content),
    );
    expect(header).toBeDefined();
    const intro = structure.sections.facts.items.find(
      (i) => i.type === 'affirmative_defenses_intro',
    );
    expect(intro).toBeDefined();
    expect(intro.content).toMatch(/affirmative defenses are pleaded/);
  });

  test('does NOT auto-render the prenup defense when the fact is absent', () => {
    const structure = flAnswer(baseFacts);
    const defenses = structure.sections.facts.items.filter(
      (i) => i.type === 'affirmative_defense',
    );
    expect(defenses.some((d) => /PRENUPTIAL/i.test(d.content))).toBe(false);
  });

  test('user-supplied affirmative defenses are transcribed verbatim (sanitized)', () => {
    const structure = flAnswer({
      ...baseFacts,
      affirmativeDefenses: [
        'Statute of limitations bars the claim for reimbursement of separate property',
      ],
    });
    const defenses = structure.sections.facts.items.filter(
      (i) => i.type === 'affirmative_defense',
    );
    expect(defenses.some((d) => /Statute of limitations bars/.test(d.content))).toBe(true);
  });

  test('offers a counter-petition citing Fla. Fam. L.R.P. Form 12.903(b)', () => {
    const structure = flAnswer(baseFacts);
    const offer = structure.sections.facts.items.find(
      (i) => i.type === 'counter_petition_offer',
    );
    expect(offer).toBeDefined();
    expect(offer.content).toMatch(/Counter-Petition/);
    expect(offer.content).toMatch(/12\.903\(b\)/);
    expect(offer.content).toMatch(/restoration of a former name/);
    expect(offer.content).toMatch(/§ 61\.16/);
  });

  test('the counter-petition offer is suppressed when a counterclaim is already included', () => {
    const structure = flAnswer({ ...baseFacts, includeCounterclaim: true });
    const offer = structure.sections.facts.items.find(
      (i) => i.type === 'counter_petition_offer',
    );
    expect(offer).toBeUndefined();
  });

  test('conclusion carries a certificate of service', () => {
    const { sections } = flAnswer(baseFacts);
    expect(sections.conclusion).toMatch(/CERTIFICATE OF SERVICE/);
    expect(sections.conclusion).toMatch(/mailed or hand-delivered/);
    expect(sections.conclusion).toMatch(/Petitioner/);
  });

  test('verification cites Fla. Fam. L.R.P. 12.020 / Fla. Stat. § 92.525', () => {
    const { sections } = flAnswer(baseFacts);
    expect(sections.perjuryStatement).toMatch(/penalty of perjury/);
    expect(sections.perjuryStatement).toMatch(/Fla\. Fam\. L\.R\.P\. 12\.020/);
    expect(sections.perjuryStatement).toMatch(/§\s*92\.525/);
  });

  test('numbered items number consecutively from 1 without gaps', () => {
    const structure = flAnswer({ ...baseFacts, prenupSigned: true, prenupYear: '2018' });
    // Round-2 fix: section_header items are OUT of the numbered flow — they
    // carry no `number`. Filter them out first, then assert consecutive
    // 1..N numbering on the remaining content items.
    const numbered = structure.sections.facts.items.filter(
      (i) => i.type !== 'section_header',
    );
    numbered.forEach((item, idx) => {
      expect(item.number).toBe(idx + 1);
    });
  });
});

// Cross-jurisdiction: every extended jurisdiction gets the same substantive
// scaffold + affirmative-defenses + counter-petition offer behaviour.
const OTHER_JURISDICTIONS = [
  { name: 'California', build: caAnswer, filerLabel: 'Respondent', formHint: 'FL-120' },
  { name: 'Georgia', build: gaAnswer, filerLabel: 'Defendant', formHint: '9-11-13' },
  { name: 'New York', build: nyAnswer, filerLabel: 'Defendant', formHint: '3011' },
  { name: 'Texas', build: txAnswer, filerLabel: 'Respondent', formHint: 'Tex. R. Civ. P. 97' },
  { name: 'Ontario', build: onAnswer, filerLabel: 'Respondent', formHint: 'Form 10' },
  { name: 'Alberta', build: abAnswer, filerLabel: 'Defendant', formHint: '3.56' },
];

describe.each(OTHER_JURISDICTIONS)(
  '$name Answer — shared substantive scaffold',
  ({ build, filerLabel, formHint }) => {
    test('carries a general denial and a scaffold with at least 8 items', () => {
      const structure = build(baseFacts);
      const general = structure.sections.facts.items.filter((i) => i.type === 'general_denial');
      expect(general.length).toBe(1);
      expect(general[0].content).toMatch(new RegExp(`${filerLabel} denies each and every`));
      // Round-2 fix: heading lives in a distinct section_header (base
      // scaffold) OR form10_header (Ontario's Form 10 supplies its own
      // PART A / B / C headings instead of the generic GENERAL DENIAL
      // banner) item. Either shape signals the pleading is properly split.
      const items = structure.sections.facts.items;
      const genericHeader = items.find(
        (i) => i.type === 'section_header' && /GENERAL DENIAL/.test(i.content),
      );
      const form10Header = items.find(
        (i) => i.type === 'form10_header' && /PART A/.test(i.content),
      );
      expect(Boolean(genericHeader) || Boolean(form10Header)).toBe(true);
      const positions = structure.sections.facts.items.filter((i) => i.type === 'answer_position');
      expect(positions.length).toBeGreaterThanOrEqual(8);
    });

    test('renders a prenup affirmative defense when prenupSigned=true', () => {
      const structure = build({ ...baseFacts, prenupSigned: true, prenupYear: '2019' });
      const prenup = structure.sections.facts.items.find(
        (i) => i.type === 'affirmative_defense' && /PRENUPTIAL AGREEMENT/.test(i.content),
      );
      expect(prenup).toBeDefined();
      expect(prenup.content).toMatch(/2019/);
    });

    test('offers a counter-petition with the jurisdiction-specific form citation', () => {
      const structure = build(baseFacts);
      const offer = structure.sections.facts.items.find(
        (i) => i.type === 'counter_petition_offer',
      );
      expect(offer).toBeDefined();
      expect(offer.content).toContain(formHint);
    });
  },
);
