'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/zaDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ZA', stateName: 'South Africa', phases: PHASES, phaseOrder: PHASE_ORDER });
