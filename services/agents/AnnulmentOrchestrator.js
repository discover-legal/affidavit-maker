'use strict';

const BaseMatterOrchestrator = require('./BaseMatterOrchestrator');
const { PHASES, PHASE_ORDER, FIELD_MAP, buildTool } = require('./prompts/annulment/index');

module.exports = new BaseMatterOrchestrator({
  stateCode:      '*',
  stateName:      null,
  matterTypeCode: 'annulment',
  practiceArea:   'family',
  phases:         PHASES,
  phaseOrder:     PHASE_ORDER,
  fieldMap:       FIELD_MAP,
  buildTool
});
