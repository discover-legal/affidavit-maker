'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_RJ', stateName: 'Rajasthan', defaultCourt: 'Family Court, Jaipur', defaultCity: 'Jaipur', stampPaperValue: 'INR 50', metadataPath: '../states/rajasthan/metadata.json' });
