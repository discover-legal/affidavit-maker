'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_RJ', stateName: 'Rajasthan', defaultCourt: 'Family Court, Jaipur', defaultCity: 'Jaipur', stampPaperValue: 'INR 20', metadataPath: '../states/rajasthan/metadata.json' });
