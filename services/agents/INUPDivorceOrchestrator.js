'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inupDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_UP', stateName: 'Uttar Pradesh', phases: PHASES, phaseOrder: PHASE_ORDER });
