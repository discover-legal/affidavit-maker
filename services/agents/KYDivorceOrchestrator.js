'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/kyDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'KY', stateName: 'Kentucky', phases: PHASES, phaseOrder: PHASE_ORDER });
