'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_MP', stateName: 'Madhya Pradesh', defaultCourt: 'Family Court, Bhopal', defaultCity: 'Bhopal', stampPaperValue: 'INR 200', metadataPath: '../states/madhya_pradesh/metadata.json' });
