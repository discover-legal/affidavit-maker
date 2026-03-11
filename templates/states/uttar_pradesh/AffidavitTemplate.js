'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_UP', stateName: 'Uttar Pradesh', defaultCourt: 'Family Court, Lucknow', defaultCity: 'Lucknow', stampPaperValue: 'INR 10', metadataPath: '../states/uttar_pradesh/metadata.json' });
