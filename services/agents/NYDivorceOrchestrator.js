'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/nyDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'NY', stateName: 'New York', phases: PHASES, phaseOrder: PHASE_ORDER });
