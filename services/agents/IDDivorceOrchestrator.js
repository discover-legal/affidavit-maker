'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/idDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'ID', stateName: 'Idaho', phases: PHASES, phaseOrder: PHASE_ORDER });
