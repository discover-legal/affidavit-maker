'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inmhDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_MH', stateName: 'Maharashtra', phases: PHASES, phaseOrder: PHASE_ORDER });
