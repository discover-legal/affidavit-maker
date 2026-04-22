'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nirDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NIR', stateName: 'Northern Ireland', phases: PHASES, phaseOrder: PHASE_ORDER });
