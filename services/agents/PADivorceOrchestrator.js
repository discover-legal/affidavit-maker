'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/paDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'PA', stateName: 'Pennsylvania', phases: PHASES, phaseOrder: PHASE_ORDER });
