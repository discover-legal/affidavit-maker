'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_GJ', stateName: 'Gujarat', defaultCourt: 'Family Court, Ahmedabad', defaultCity: 'Ahmedabad', stampPaperValue: 'INR 20', metadataPath: '../states/gujarat/metadata.json' });
