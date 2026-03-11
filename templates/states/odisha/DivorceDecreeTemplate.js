'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_OD', stateName: 'Odisha', defaultCourt: 'Family Court, Bhubaneswar', defaultCity: 'Bhubaneswar', stampPaperValue: 'INR 10', metadataPath: '../states/odisha/metadata.json' });
