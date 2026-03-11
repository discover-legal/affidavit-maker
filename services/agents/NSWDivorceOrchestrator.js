'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nswDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NSW', stateName: 'New South Wales', phases: PHASES, phaseOrder: PHASE_ORDER });
