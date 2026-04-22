'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/mtDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MT', stateName: 'Montana', phases: PHASES, phaseOrder: PHASE_ORDER });
