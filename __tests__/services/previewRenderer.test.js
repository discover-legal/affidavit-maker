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

  test('generateBoth returns items array and formatted string for empty facts', () => {
    const affidavit = { state: 'UT', county: 'Salt Lake', affiantName: 'A Person', facts: [] };
    const { formatted, items } = previewRenderer.generateBoth(affidavit);

    expect(typeof formatted).toBe('string');
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
    expect(formatted).toMatch(/No facts/);
  });
});
