'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/azDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AZ', stateName: 'Arizona', phases: PHASES, phaseOrder: PHASE_ORDER });
