'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/inbrDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_BR', stateName: 'Bihar', phases: PHASES, phaseOrder: PHASE_ORDER });
