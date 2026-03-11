'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/edDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ED', stateName: 'Edo', phases: PHASES, phaseOrder: PHASE_ORDER });
