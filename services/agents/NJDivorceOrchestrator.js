'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/njDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NJ', stateName: 'New Jersey', phases: PHASES, phaseOrder: PHASE_ORDER });
