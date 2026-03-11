'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/meDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ME', stateName: 'Maine', phases: PHASES, phaseOrder: PHASE_ORDER });
