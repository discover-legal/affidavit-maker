'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ytDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'YT', stateName: 'Yukon', phases: PHASES, phaseOrder: PHASE_ORDER });
