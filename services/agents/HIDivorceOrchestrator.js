'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/hiDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'HI', stateName: 'Hawaii', phases: PHASES, phaseOrder: PHASE_ORDER });
