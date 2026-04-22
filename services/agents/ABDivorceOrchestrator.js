'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/abDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AB', stateName: 'Alberta', phases: PHASES, phaseOrder: PHASE_ORDER });
