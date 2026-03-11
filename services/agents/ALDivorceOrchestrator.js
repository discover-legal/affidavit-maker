'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/alDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AL', stateName: 'Alabama', phases: PHASES, phaseOrder: PHASE_ORDER });
