'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/sgDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SG', stateName: 'Singapore', phases: PHASES, phaseOrder: PHASE_ORDER });
