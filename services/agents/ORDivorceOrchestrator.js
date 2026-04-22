'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/orDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'OR', stateName: 'Oregon', phases: PHASES, phaseOrder: PHASE_ORDER });
