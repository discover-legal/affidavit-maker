'use strict';

/**
 * TXDivorceOrchestrator
 *
 * Texas divorce interview agent. Thin wrapper around BaseDivorceOrchestrator
 * that provides TX-specific phase prompts (residency: 6 months state + 90 days
 * county, insupportability grounds, INDIGENCY phase, community property, etc.)
 *
 * All mechanics (LLM calling, field extraction, phase advancement, fact
 * organization, document selection) live in BaseDivorceOrchestrator.
 */

const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/txDivorce/index');

module.exports = new BaseDivorceOrchestrator({
  stateCode:  'TX',
  stateName:  'Texas',
  phases:     PHASES,
  phaseOrder: PHASE_ORDER,
});
