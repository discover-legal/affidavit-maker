'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_TS', stateName: 'Telangana', defaultCourt: 'Family Court, Hyderabad', defaultCity: 'Hyderabad', stampPaperValue: 'INR 20', metadataPath: '../states/telangana/metadata.json' });
