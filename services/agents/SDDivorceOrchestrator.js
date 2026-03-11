'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/sdDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SD', stateName: 'South Dakota', phases: PHASES, phaseOrder: PHASE_ORDER });
