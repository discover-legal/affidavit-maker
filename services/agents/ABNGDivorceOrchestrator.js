'use strict';
const BaseDivorceOrchestrator = require('./BaseDivorceOrchestrator');
const { PHASES, PHASE_ORDER } = require('./prompts/abngDivorce/index');
module.exports = new BaseDivorceOrchestrator({ stateCode: 'AB_NG', stateName: 'Abia', phases: PHASES, phaseOrder: PHASE_ORDER });
