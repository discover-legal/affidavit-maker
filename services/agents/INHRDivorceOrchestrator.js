'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inhrDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_HR', stateName: 'Haryana', phases: PHASES, phaseOrder: PHASE_ORDER });
