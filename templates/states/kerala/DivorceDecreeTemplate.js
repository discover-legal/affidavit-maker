'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_KL', stateName: 'Kerala', defaultCourt: 'Family Court, Ernakulam', defaultCity: 'Ernakulam', stampPaperValue: 'INR 50', metadataPath: '../states/kerala/metadata.json' });
