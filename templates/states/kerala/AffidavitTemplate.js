'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_KL', stateName: 'Kerala', defaultCourt: 'Family Court, Ernakulam', defaultCity: 'Ernakulam', stampPaperValue: 'INR 50', metadataPath: '../states/kerala/metadata.json' });
