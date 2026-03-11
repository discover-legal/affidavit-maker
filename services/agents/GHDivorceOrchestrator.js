'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ghDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'GH', stateName: 'Ghana', phases: PHASES, phaseOrder: PHASE_ORDER });
