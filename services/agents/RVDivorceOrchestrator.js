'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/rvDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'RV', stateName: 'Rivers', phases: PHASES, phaseOrder: PHASE_ORDER });
