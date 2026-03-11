'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ksDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'KS', stateName: 'Kansas', phases: PHASES, phaseOrder: PHASE_ORDER });
