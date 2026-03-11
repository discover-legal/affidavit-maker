'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/scoDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SCO', stateName: 'Scotland', phases: PHASES, phaseOrder: PHASE_ORDER });
