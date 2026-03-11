'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/deDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'DE', stateName: 'Delaware', phases: PHASES, phaseOrder: PHASE_ORDER });
