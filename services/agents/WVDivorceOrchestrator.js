'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/wvDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'WV', stateName: 'West Virginia', phases: PHASES, phaseOrder: PHASE_ORDER });
