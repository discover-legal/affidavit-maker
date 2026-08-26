/** @jest-environment node */
const previewRenderer = require('../../services/previewRenderer');

describe('previewRenderer', () => {
  test('generateFormattedString produces a numbered list and header', () => {
    const affidavit = {
      state: 'TX',
      county: 'Travis',
      affiantName: 'Jane Doe',
      facts: [
        { content: 'I saw the event.' },
        { content: 'I spoke with the witness.' }
      ]
    };

    const formatted = previewRenderer.generateFormattedString(affidavit);

    expect(formatted).toMatch(/STATE OF TX/);
    expect(formatted).toMatch(/COUNTY OF Travis/);
    expect(formatted).toMatch(/I, Jane Doe/);
    expect(formatted).toMatch(/1\. I saw the event\./);
    expect(formatted).toMatch(/2\. I spoke with the witness\./);
  });

  test('Canadian provinces get PROVINCE OF header and no county line', () => {
    const affidavit = {
      state: 'ON',
      county: 'Toronto',
      affiantName: 'Jane Doe',
      facts: [{ content: 'I saw the event.' }]
    };

    const formatted = previewRenderer.generateFormattedString(affidavit);

    expect(formatted).toMatch(/PROVINCE OF ONTARIO/);
    expect(formatted).not.toMatch(/STATE OF/);
    expect(formatted).not.toMatch(/COUNTY OF/);
  });

  test('Canadian territories get the territory name alone, full names accepted', () => {
    const formatted = previewRenderer.generateFormattedString({
      state: 'Northwest Territories',
      county: 'Yellowknife',
      affiantName: 'Jane Doe',
      facts: []
    });

    expect(formatted).toMatch(/^NORTHWEST TERRITORIES\n/);
    expect(formatted).not.toMatch(/PROVINCE OF/);
    expect(formatted).not.toMatch(/COUNTY OF/);
  });

  test('generateBoth returns items array and formatted string for empty facts', () => {
    const affidavit = { state: 'UT', county: 'Salt Lake', affiantName: 'A Person', facts: [] };
    const { formatted, items } = previewRenderer.generateBoth(affidavit);

    expect(typeof formatted).toBe('string');
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
    expect(formatted).toMatch(/No facts/);
  });
});
