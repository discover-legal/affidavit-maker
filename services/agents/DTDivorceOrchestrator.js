'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/dtDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'DT', stateName: 'Delta', phases: PHASES, phaseOrder: PHASE_ORDER });
