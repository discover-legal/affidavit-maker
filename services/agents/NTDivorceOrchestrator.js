'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ntDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NT', stateName: 'Northwest Territories', phases: PHASES, phaseOrder: PHASE_ORDER });
