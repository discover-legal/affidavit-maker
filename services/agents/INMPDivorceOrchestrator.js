'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inmpDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_MP', stateName: 'Madhya Pradesh', phases: PHASES, phaseOrder: PHASE_ORDER });
