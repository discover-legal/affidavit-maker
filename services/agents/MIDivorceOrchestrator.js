'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/miDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MI', stateName: 'Michigan', phases: PHASES, phaseOrder: PHASE_ORDER });
