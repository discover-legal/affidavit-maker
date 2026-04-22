'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/wyDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'WY', stateName: 'Wyoming', phases: PHASES, phaseOrder: PHASE_ORDER });
