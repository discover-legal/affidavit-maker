'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nuDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NU', stateName: 'Nunavut', phases: PHASES, phaseOrder: PHASE_ORDER });
