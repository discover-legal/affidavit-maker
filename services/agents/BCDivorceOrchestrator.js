'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/bcDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'BC', stateName: 'British Columbia', phases: PHASES, phaseOrder: PHASE_ORDER });
