'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
const Base = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_MP', stateName: 'Madhya Pradesh', defaultCourt: 'Family Court, Bhopal', defaultCity: 'Bhopal', stampPaperValue: 'INR 200', metadataPath: '../states/madhya_pradesh/metadata.json' });

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
