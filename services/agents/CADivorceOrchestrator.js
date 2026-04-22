'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/caDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'CA', stateName: 'California', phases: PHASES, phaseOrder: PHASE_ORDER });
