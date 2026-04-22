'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/indlDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IN_DL', stateName: 'Delhi', phases: PHASES, phaseOrder: PHASE_ORDER });
