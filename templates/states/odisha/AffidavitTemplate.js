'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_OD', stateName: 'Odisha', defaultCourt: 'Family Court, Bhubaneswar', defaultCity: 'Bhubaneswar', stampPaperValue: 'INR 10', metadataPath: '../states/odisha/metadata.json' });
