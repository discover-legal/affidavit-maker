'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_HR', stateName: 'Haryana', defaultCourt: 'Family Court, Gurugram', defaultCity: 'Gurugram', stampPaperValue: 'INR 10', metadataPath: '../states/haryana/metadata.json' });
