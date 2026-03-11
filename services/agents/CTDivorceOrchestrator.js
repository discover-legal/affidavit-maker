'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ctDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'CT', stateName: 'Connecticut', phases: PHASES, phaseOrder: PHASE_ORDER });
