'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/utDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'UT', stateName: 'Utah', phases: PHASES, phaseOrder: PHASE_ORDER });
