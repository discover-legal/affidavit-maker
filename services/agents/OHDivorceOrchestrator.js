'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/ohDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'OH', stateName: 'Ohio', phases: PHASES, phaseOrder: PHASE_ORDER });
