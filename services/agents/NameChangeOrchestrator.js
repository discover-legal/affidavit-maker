'use strict';

const BaseMatterOrchestrator = require('./BaseMatterOrchestrator');
const { PHASES, PHASE_ORDER, FIELD_MAP, buildTool } = require('./prompts/nameChange/index');

module.exports = new BaseMatterOrchestrator({
  stateCode:      '*',
  stateName:      null,
  matterTypeCode: 'name_change',
  practiceArea:   'civil',
  phases:         PHASES,
  phaseOrder:     PHASE_ORDER,
  fieldMap:       FIELD_MAP,
  buildTool
});
