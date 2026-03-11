'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_PB', stateName: 'Punjab', defaultCourt: 'Family Court, Chandigarh', defaultCity: 'Chandigarh', stampPaperValue: 'INR 15', metadataPath: '../states/punjab/metadata.json' });
