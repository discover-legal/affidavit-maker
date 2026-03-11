'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inpbDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_PB', stateName: 'Punjab', phases: PHASES, phaseOrder: PHASE_ORDER });
