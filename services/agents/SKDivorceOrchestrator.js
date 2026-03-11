'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/skDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SK', stateName: 'Saskatchewan', phases: PHASES, phaseOrder: PHASE_ORDER });
