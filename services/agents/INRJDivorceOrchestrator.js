'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inrjDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_RJ', stateName: 'Rajasthan', phases: PHASES, phaseOrder: PHASE_ORDER });
