'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/waDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'WA', stateName: 'Washington', phases: PHASES, phaseOrder: PHASE_ORDER });
