'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/riDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'RI', stateName: 'Rhode Island', phases: PHASES, phaseOrder: PHASE_ORDER });
