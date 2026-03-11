'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/imDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IM', stateName: 'Imo', phases: PHASES, phaseOrder: PHASE_ORDER });
