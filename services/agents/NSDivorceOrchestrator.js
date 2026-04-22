'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nsDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NS', stateName: 'Nova Scotia', phases: PHASES, phaseOrder: PHASE_ORDER });
