'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/actDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ACT', stateName: 'Australian Capital Territory', phases: PHASES, phaseOrder: PHASE_ORDER });
