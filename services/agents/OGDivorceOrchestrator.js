'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ogDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'OG', stateName: 'Ogun', phases: PHASES, phaseOrder: PHASE_ORDER });
