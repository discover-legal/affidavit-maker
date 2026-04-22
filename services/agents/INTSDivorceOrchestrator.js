'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/intsDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_TS', stateName: 'Telangana', phases: PHASES, phaseOrder: PHASE_ORDER });
