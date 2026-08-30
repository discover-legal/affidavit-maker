/**
 * Ontario Divorce Order — parenting section (Marcus/Priya audit fix).
 *
 * The template previously derived "primary residence" from the custody-kind
 * enum, so a case with custody='sole_respondent' rendered the respondent
 * (Marcus) as primary parent even though the transcript said the children
 * lived mostly with Priya (applicant). Primary residence must come from the
 * explicit primaryResidence / primaryCustodian fact and only from that.
 */

'use strict';

const OntarioDivorceDecreeTemplate =
  require('../../templates/states/ontario/DivorceDecreeTemplate');

function renderCustody(data) {
  const tpl = new OntarioDivorceDecreeTemplate();
  const section = tpl.generateChildCustodySection(data);
  return { section, body: section.items.map((i) => i.content).join('\n') };
}

const kids = [{ name: 'Ava', birthDate: '2016-05-01' }];

describe('Ontario Divorce Order — primary residence pulled from custodyArrangement / primaryResidenceName', () => {
  test('primaryResidence=petitioner (Priya) wins over custody enum contradiction', () => {
    const { body } = renderCustody({
      petitionerName: 'Priya Thompson',
      respondentName: 'Marcus Thompson',
      hasMinorChildren: true,
      children: kids,
      custodyType: 'sole_respondent',
      primaryResidence: 'petitioner',
    });
    expect(body).toMatch(/primarily reside with Priya Thompson/);
    expect(body).not.toMatch(/primarily reside with Marcus Thompson/);
  });

  test('primaryResidence names the applicant explicitly when custody enum is missing', () => {
    const { body } = renderCustody({
      petitionerName: 'Priya Thompson',
      respondentName: 'Marcus Thompson',
      hasMinorChildren: true,
      children: kids,
      primaryResidence: 'Priya Thompson',
    });
    expect(body).toMatch(/primarily reside with Priya Thompson/);
  });

  test('respondent as primary residence renders faithfully when data actually says so', () => {
    const { body } = renderCustody({
      petitionerName: 'Priya Thompson',
      respondentName: 'Marcus Thompson',
      hasMinorChildren: true,
      children: kids,
      primaryResidence: 'respondent',
      custodyType: 'sole_respondent',
    });
    expect(body).toMatch(/primarily reside with Marcus Thompson/);
  });

  test('missing primaryResidence never defaults to a party — placeholder or silence only', () => {
    const { body } = renderCustody({
      petitionerName: 'Priya Thompson',
      respondentName: 'Marcus Thompson',
      hasMinorChildren: true,
      children: kids,
      custodyType: 'joint',
    });
    // Neither party auto-inserted; a bracketed placeholder is fine.
    expect(body).not.toMatch(/primarily reside with Priya Thompson/);
    expect(body).not.toMatch(/primarily reside with Marcus Thompson/);
  });
});
