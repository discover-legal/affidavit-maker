'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nzDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NZ', stateName: 'New Zealand', phases: PHASES, phaseOrder: PHASE_ORDER });
