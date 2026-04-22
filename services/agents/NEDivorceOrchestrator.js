'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/neDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NE', stateName: 'Nebraska', phases: PHASES, phaseOrder: PHASE_ORDER });
