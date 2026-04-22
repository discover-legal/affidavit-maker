'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/enDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'EN', stateName: 'Enugu', phases: PHASES, phaseOrder: PHASE_ORDER });
