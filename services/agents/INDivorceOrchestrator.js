'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN', stateName: 'Indiana', phases: PHASES, phaseOrder: PHASE_ORDER });
