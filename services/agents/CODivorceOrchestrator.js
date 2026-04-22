'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/coDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'CO', stateName: 'Colorado', phases: PHASES, phaseOrder: PHASE_ORDER });
