'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/moDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MO', stateName: 'Missouri', phases: PHASES, phaseOrder: PHASE_ORDER });
