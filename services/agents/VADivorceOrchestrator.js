'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/vaDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'VA', stateName: 'Virginia', phases: PHASES, phaseOrder: PHASE_ORDER });
