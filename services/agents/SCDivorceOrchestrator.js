'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/scDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'SC', stateName: 'South Carolina', phases: PHASES, phaseOrder: PHASE_ORDER });
