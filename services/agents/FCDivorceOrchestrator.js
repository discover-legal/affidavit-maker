'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/fcDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'FC', stateName: 'Federal Capital Territory', phases: PHASES, phaseOrder: PHASE_ORDER });
