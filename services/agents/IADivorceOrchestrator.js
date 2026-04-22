'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/iaDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IA', stateName: 'Iowa', phases: PHASES, phaseOrder: PHASE_ORDER });
