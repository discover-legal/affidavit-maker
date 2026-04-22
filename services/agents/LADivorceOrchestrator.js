'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/laDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'LA', stateName: 'Louisiana', phases: PHASES, phaseOrder: PHASE_ORDER });
