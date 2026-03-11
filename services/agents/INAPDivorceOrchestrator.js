'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inapDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_AP', stateName: 'Andhra Pradesh', phases: PHASES, phaseOrder: PHASE_ORDER });
