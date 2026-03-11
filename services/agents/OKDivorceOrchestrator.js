'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/okDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'OK', stateName: 'Oklahoma', phases: PHASES, phaseOrder: PHASE_ORDER });
