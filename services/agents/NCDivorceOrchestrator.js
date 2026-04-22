'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ncDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NC', stateName: 'North Carolina', phases: PHASES, phaseOrder: PHASE_ORDER });
