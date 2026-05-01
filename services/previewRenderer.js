const { prepareFactsForDisplay } = require('../utils/factNormalizer');

/**
 * previewRenderer - small service to produce formatted output (string) and UI items from canonical facts
 * Keeps formatting logic centralized so server routes and PDF generator can reuse it.
 */
const previewRenderer = {
  /**
   * Generate a formatted string suitable for PDFs from affidavit data
   * @param {object} affidavitData - canonical affidavit object with facts array
   * @returns {string}
   */
  generateFormattedString(affidavitData) {
    if (!affidavitData) return '';

    const facts = Array.isArray(affidavitData.facts) ? affidavitData.facts : [];
    const items = prepareFactsForDisplay(facts);

    // Simple formatting: numbered facts with paragraph breaks. Keep this function small and deterministic.
    const header = `STATE OF ${affidavitData.state || '[STATE]'}\nCOUNTY OF ${affidavitData.county || '[COUNTY]'}\n\n`;

    const intro = `I, ${affidavitData.affiantName || '[NAME]'}, being first duly sworn, depose and state as follows:\n\n`;

    const factsText = items.length > 0
      ? items.map((f, idx) => `${idx + 1}. ${f.displayContent}`).join('\n\n')
      : 'No facts have been added yet.';

    const conclusion = `\n\nI declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge and belief.`;

    const formatted = `${header}${intro}${factsText}${conclusion}`;
    return formatted;
  },

  /**
   * Generate both formats: the formatted string and the structured items array
   * @param {object} affidavitData
   * @returns {{ formatted: string, items: array }}
   */
  generateBoth(affidavitData) {
    const items = prepareFactsForDisplay((affidavitData && affidavitData.facts) || []);
    const formatted = this.generateFormattedString(affidavitData);
    return { formatted, items };
  }
};

module.exports = previewRenderer;
