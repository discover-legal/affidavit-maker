'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nbDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NB', stateName: 'New Brunswick', phases: PHASES, phaseOrder: PHASE_ORDER });
