'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/arDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AR', stateName: 'Arkansas', phases: PHASES, phaseOrder: PHASE_ORDER });
