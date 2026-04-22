'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/keDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'KE', stateName: 'Kenya', phases: PHASES, phaseOrder: PHASE_ORDER });
