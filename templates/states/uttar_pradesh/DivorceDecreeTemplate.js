'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_UP', stateName: 'Uttar Pradesh', defaultCourt: 'Family Court, Lucknow', defaultCity: 'Lucknow', stampPaperValue: 'INR 10', metadataPath: '../states/uttar_pradesh/metadata.json' });
