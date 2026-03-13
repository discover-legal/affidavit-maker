'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_OD', stateName: 'Odisha', defaultCourt: 'Family Court, Bhubaneswar', defaultCity: 'Bhubaneswar', stampPaperValue: 'INR 15', metadataPath: '../states/odisha/metadata.json' });
