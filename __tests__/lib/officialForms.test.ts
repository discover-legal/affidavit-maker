/** @jest-environment node */

import { officialFormsLink } from '@/lib/officialForms';

describe('officialFormsLink', () => {
  it('returns the Utah courts forms page', () => {
    const utah = officialFormsLink('UT');
    expect(utah).not.toBeNull();
    expect(utah!.url).toMatch(/^https:\/\/(www\.)?utcourts\.gov\//);
    expect(utah!.name).toMatch(/Utah/);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(officialFormsLink(' ut ')).toEqual(officialFormsLink('UT'));
  });

  it('returns null for unknown or empty jurisdictions', () => {
    expect(officialFormsLink('ZZ')).toBeNull();
    expect(officialFormsLink('')).toBeNull();
    expect(officialFormsLink(undefined as unknown as string)).toBeNull();
  });

  it('deliberately has no entry where no official statewide forms page exists', () => {
    // LA: forms are per judicial district; NU: forms live inside Rules PDFs.
    expect(officialFormsLink('LA')).toBeNull();
    expect(officialFormsLink('NU')).toBeNull();
  });

  it('every entry is https on an official domain shape and has a display name', () => {
    // Spot the whole table through the public API by probing known codes.
    const codes = [
      'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
      'KS','KY','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
      'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
      'WI','WY','ON','BC','AB','MB','SK','QC','NS','NB','NL','PE','YT','NT',
    ];
    for (const code of codes) {
      const entry = officialFormsLink(code);
      expect(entry).not.toBeNull();
      expect(entry!.url).toMatch(/^https:\/\//);
      // Official domains only: .gov, .us state courts, or known court domains.
      expect(entry!.url).toMatch(
        /\.(gov|gouv\.qc\.ca|on\.ca|gov\.bc\.ca|mb\.ca|ns\.ca|nl\.ca|pe\.ca|us)\/|courts?|judicial|judiciary|ujs\.sd|oscn/i,
      );
      expect(entry!.name.length).toBeGreaterThan(5);
    }
  });
});
