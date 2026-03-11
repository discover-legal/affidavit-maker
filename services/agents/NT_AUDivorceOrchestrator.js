'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ntAuDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NT_AU', stateName: 'Northern Territory', phases: PHASES, phaseOrder: PHASE_ORDER });
