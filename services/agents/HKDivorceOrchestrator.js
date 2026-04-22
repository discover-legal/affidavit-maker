'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/hkDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'HK', stateName: 'Hong Kong', phases: PHASES, phaseOrder: PHASE_ORDER });
