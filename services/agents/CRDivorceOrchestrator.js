'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/crDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'CR', stateName: 'Cross River', phases: PHASES, phaseOrder: PHASE_ORDER });
