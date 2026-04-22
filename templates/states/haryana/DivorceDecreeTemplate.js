'use strict';
const { createIndiaDivorceDecreeTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorceDecreeTemplate({ stateCode: 'IN_HR', stateName: 'Haryana', defaultCourt: 'Family Court, Gurugram', defaultCity: 'Gurugram', stampPaperValue: 'INR 10', metadataPath: '../states/haryana/metadata.json' });
