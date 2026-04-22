'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/waAuDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'WA_AU', stateName: 'Western Australia', phases: PHASES, phaseOrder: PHASE_ORDER });
