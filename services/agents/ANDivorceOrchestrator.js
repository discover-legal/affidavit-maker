'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/anDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AN', stateName: 'Anambra', phases: PHASES, phaseOrder: PHASE_ORDER });
