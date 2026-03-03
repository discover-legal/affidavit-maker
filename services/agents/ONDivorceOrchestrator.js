'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/onDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ON', stateName: 'Ontario', phases: PHASES, phaseOrder: PHASE_ORDER });
