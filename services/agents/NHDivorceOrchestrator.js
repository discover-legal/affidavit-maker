'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nhDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NH', stateName: 'New Hampshire', phases: PHASES, phaseOrder: PHASE_ORDER });
