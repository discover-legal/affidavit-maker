'use strict';

// services/childSupport/index.js
// State-dispatched child support estimation. Utah only for now; every state
// module must follow the same contract as ./utah.js: statutory table data in
// its own verbatim-encoded data module, calculator that refuses to invent
// numbers, and ESTIMATE/not-legal-advice framing on every result.

const {
  calculateUtah,
  validateTable,
  OFFICIAL_CALCULATOR_URL,
  ESTIMATE_DISCLAIMER,
} = require('./utah');

const CALCULATORS = {
  UT: calculateUtah,
};

/**
 * Estimate child support for a state.
 * @param {string} state - two-letter code (case-insensitive)
 * @param {object} data - stored story/interview data
 * @returns the state calculator's result, or null when the state is unsupported
 */
function calculate(state, data) {
  const calculator = CALCULATORS[String(state || '').toUpperCase()];
  return calculator ? calculator(data) : null;
}

module.exports = {
  calculate,
  calculateUtah,
  validateTable,
  OFFICIAL_CALCULATOR_URL,
  ESTIMATE_DISCLAIMER,
};
