'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/peDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'PE', stateName: 'Prince Edward Island', phases: PHASES, phaseOrder: PHASE_ORDER });
