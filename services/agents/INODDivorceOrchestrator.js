'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inodDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_OD', stateName: 'Odisha', phases: PHASES, phaseOrder: PHASE_ORDER });
