'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/mnDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MN', stateName: 'Minnesota', phases: PHASES, phaseOrder: PHASE_ORDER });
