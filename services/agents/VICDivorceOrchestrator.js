'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/vicDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'VIC', stateName: 'Victoria', phases: PHASES, phaseOrder: PHASE_ORDER });
