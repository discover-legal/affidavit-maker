'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ndDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ND', stateName: 'North Dakota', phases: PHASES, phaseOrder: PHASE_ORDER });
