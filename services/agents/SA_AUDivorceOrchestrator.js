'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/saAuDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SA_AU', stateName: 'South Australia', phases: PHASES, phaseOrder: PHASE_ORDER });
