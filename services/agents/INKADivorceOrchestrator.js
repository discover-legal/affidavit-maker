'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inkaDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_KA', stateName: 'Karnataka', phases: PHASES, phaseOrder: PHASE_ORDER });
