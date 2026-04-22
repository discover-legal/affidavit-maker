'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/intnDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_TN', stateName: 'Tamil Nadu', phases: PHASES, phaseOrder: PHASE_ORDER });
