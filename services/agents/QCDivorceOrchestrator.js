'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/qcDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'QC', stateName: 'Quebec', phases: PHASES, phaseOrder: PHASE_ORDER });
