'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/mbDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'MB', stateName: 'Manitoba', phases: PHASES, phaseOrder: PHASE_ORDER });
