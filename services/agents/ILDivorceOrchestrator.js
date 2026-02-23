'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ilDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'IL', stateName: 'Illinois', phases: PHASES, phaseOrder: PHASE_ORDER });
