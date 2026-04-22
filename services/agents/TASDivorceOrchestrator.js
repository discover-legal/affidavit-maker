'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/tasDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'TAS', stateName: 'Tasmania', phases: PHASES, phaseOrder: PHASE_ORDER });
