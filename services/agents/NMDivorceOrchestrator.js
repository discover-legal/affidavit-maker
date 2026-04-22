'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nmDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NM', stateName: 'New Mexico', phases: PHASES, phaseOrder: PHASE_ORDER });
