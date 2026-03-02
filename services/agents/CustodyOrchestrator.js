'use strict';

const BaseMatterOrchestrator = require('./BaseMatterOrchestrator');
const { PHASES, PHASE_ORDER, FIELD_MAP, buildTool } = require('./prompts/custody/index');

module.exports = new BaseMatterOrchestrator({
  stateCode:      '*',
  stateName:      null,
  matterTypeCode: 'custody',
  practiceArea:   'family',
  phases:         PHASES,
  phaseOrder:     PHASE_ORDER,
  fieldMap:       FIELD_MAP,
  buildTool
});
