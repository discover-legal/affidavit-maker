'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nlDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NL', stateName: 'Newfoundland and Labrador', phases: PHASES, phaseOrder: PHASE_ORDER });
