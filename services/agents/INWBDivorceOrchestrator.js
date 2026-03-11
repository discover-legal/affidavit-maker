'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inwbDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_WB', stateName: 'West Bengal', phases: PHASES, phaseOrder: PHASE_ORDER });
