'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/irlDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IRL', stateName: 'Ireland', phases: PHASES, phaseOrder: PHASE_ORDER });
