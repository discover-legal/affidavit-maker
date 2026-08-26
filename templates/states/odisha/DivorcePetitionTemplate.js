'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
const Base = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_OD', stateName: 'Odisha', defaultCourt: 'Family Court, Bhubaneswar', defaultCity: 'Bhubaneswar', stampPaperValue: 'INR 15', metadataPath: '../states/odisha/metadata.json' });

// Indian terminology (see templates/core/terminology.js): the caption is the
// court-name line (Family Court / District Court) + district; parties are
// Petitioner/Respondent (HMA 1955 / SMA 1954). No "STATE OF"/"COUNTY OF"
// caption lines and no "X County" body phrasing.
class Template extends Base {
  constructor() {
    super();
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'State',
      districtTerm: 'District',
      districtPlaceholder: '[DISTRICT]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
  }
}

module.exports = Template;
