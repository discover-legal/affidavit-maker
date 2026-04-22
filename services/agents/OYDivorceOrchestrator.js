'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/oyDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'OY', stateName: 'Oyo', phases: PHASES, phaseOrder: PHASE_ORDER });
