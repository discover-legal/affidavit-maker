'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_BR', stateName: 'Bihar', defaultCourt: 'Family Court, Patna', defaultCity: 'Patna', stampPaperValue: 'INR 10', metadataPath: '../states/bihar/metadata.json' });
