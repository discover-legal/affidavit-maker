'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_WB', stateName: 'West Bengal', defaultCourt: 'Family Court, Kolkata', defaultCity: 'Kolkata', stampPaperValue: 'INR 10', metadataPath: '../states/west_bengal/metadata.json' });
