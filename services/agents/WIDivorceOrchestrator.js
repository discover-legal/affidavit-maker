'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/wiDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'WI', stateName: 'Wisconsin', phases: PHASES, phaseOrder: PHASE_ORDER });
