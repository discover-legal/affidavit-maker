'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/dcDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'DC', stateName: 'District of Columbia', phases: PHASES, phaseOrder: PHASE_ORDER });
