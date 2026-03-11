'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/qldDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'QLD', stateName: 'Queensland', phases: PHASES, phaseOrder: PHASE_ORDER });
