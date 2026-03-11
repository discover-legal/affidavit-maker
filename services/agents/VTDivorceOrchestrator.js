'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/vtDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'VT', stateName: 'Vermont', phases: PHASES, phaseOrder: PHASE_ORDER });
