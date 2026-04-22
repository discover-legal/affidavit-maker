'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/langDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'LA_NG', stateName: 'Lagos', phases: PHASES, phaseOrder: PHASE_ORDER });
