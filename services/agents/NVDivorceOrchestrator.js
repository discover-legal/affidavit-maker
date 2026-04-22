'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nvDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NV', stateName: 'Nevada', phases: PHASES, phaseOrder: PHASE_ORDER });
