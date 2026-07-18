/** @jest-environment node */

const UtahDivorcePetitionTemplate = require('../../../../templates/states/utah/DivorcePetitionTemplate');
const UtahDivorceDecreeTemplate = require('../../../../templates/states/utah/DivorceDecreeTemplate');
const divorceDocumentGenerator = require('../../../../services/documents/DivorceDocumentGenerator');

describe('Utah divorce county normalization', () => {
  it('does not duplicate County in the petition venue, court, or jurisdiction', () => {
    const template = new UtahDivorcePetitionTemplate();

    expect(template.generateVenue('Salt Lake County')).toBe('County of Salt Lake');
    expect(template.getDefaultCourt('Salt Lake County')).toContain('Salt Lake County');
    expect(template.getDefaultCourt('Salt Lake County')).not.toContain('County County');
    expect(template.getJurisdictionStatement({ county: 'Salt Lake County' })).not.toContain(
      'County County',
    );
  });

  it.each(['Salt Lake', 'Salt Lake County'])(
    'does not duplicate County in shared petition sections for %s',
    (county) => {
      const template = new UtahDivorcePetitionTemplate();
      const data = {
        petitionerName: 'Jordan Avery',
        respondentName: 'Morgan Avery',
        county,
      };
      const rendered = [
        ...template.generatePartiesSection(data).items,
        ...template.generateJurisdictionSection(data).items,
      ]
        .map((item) => item.content)
        .join(' ');

      expect(rendered).toContain('Salt Lake County');
      expect(rendered).not.toMatch(/County County/i);
    },
  );

  it('does not duplicate County in the decree caption or findings', () => {
    const template = new UtahDivorceDecreeTemplate();
    const data = {
      county: 'Salt Lake County',
      petitionerName: 'Jordan Avery',
      respondentName: 'Morgan Avery',
      marriageDate: '2018-09-15',
    };

    expect(template.getDefaultCourt(data.county)).not.toContain('COUNTY COUNTY');
    expect(template.generateCaseCaption(data).formatted).not.toContain('COUNTY COUNTY');
    expect(template.generateJurisdictionSection(data).text).not.toContain('County County');
  });

  it('does not invent a default judgment when appearance data is unknown', () => {
    const template = new UtahDivorceDecreeTemplate();
    const appearances = template.generateAppearancesSection({
      petitionerName: 'Jordan Avery',
      respondentName: 'Morgan Avery',
    }).text;

    expect(appearances).toContain('TO BE COMPLETED BY THE COURT');
    expect(appearances).not.toContain('properly served');
    expect(appearances).not.toContain('default was entered');
  });

  it('renders a real Utah service waiver tab without duplicating County', () => {
    const document = divorceDocumentGenerator.generate('UT', 'waiver_of_service', {
      petitionerName: 'Jordan Avery',
      respondentName: 'Morgan Avery',
      county: 'Salt Lake County',
    });
    const rendered = JSON.stringify(document.sections);

    expect(document.sections.title).toBe('WAIVER OF SERVICE OF PROCESS');
    expect(document.sections.signatureBlock.name).toBe('Morgan Avery');
    expect(rendered).toContain('SALT LAKE COUNTY');
    expect(rendered).not.toMatch(/COUNTY COUNTY/i);
  });
});
