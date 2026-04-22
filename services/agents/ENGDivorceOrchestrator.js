'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/engDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ENG', stateName: 'England & Wales', phases: PHASES, phaseOrder: PHASE_ORDER });
