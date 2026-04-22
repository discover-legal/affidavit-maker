'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/gaDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'GA', stateName: 'Georgia', phases: PHASES, phaseOrder: PHASE_ORDER });
