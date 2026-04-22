'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/maDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MA', stateName: 'Massachusetts', phases: PHASES, phaseOrder: PHASE_ORDER });
