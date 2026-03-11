'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ingjDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_GJ', stateName: 'Gujarat', phases: PHASES, phaseOrder: PHASE_ORDER });
