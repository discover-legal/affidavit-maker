'use strict';

const BaseMatterOrchestrator = require('./BaseMatterOrchestrator');
const { PHASES, PHASE_ORDER, FIELD_MAP, buildTool } = require('./prompts/debtDefense/index');

module.exports = new BaseMatterOrchestrator({
  stateCode:      '*',
  stateName:      null,
  matterTypeCode: 'debt_defense',
  practiceArea:   'civil',
  phases:         PHASES,
  phaseOrder:     PHASE_ORDER,
  fieldMap:       FIELD_MAP,
  buildTool
});
