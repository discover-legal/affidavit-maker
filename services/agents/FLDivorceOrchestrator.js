'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/flDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'FL', stateName: 'Florida', phases: PHASES, phaseOrder: PHASE_ORDER });
