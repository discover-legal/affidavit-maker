'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/tnDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'TN', stateName: 'Tennessee', phases: PHASES, phaseOrder: PHASE_ORDER });
