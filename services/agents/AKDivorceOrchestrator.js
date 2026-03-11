'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/akDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AK', stateName: 'Alaska', phases: PHASES, phaseOrder: PHASE_ORDER });
