'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_UP', stateName: 'Uttar Pradesh', defaultCourt: 'Family Court, Lucknow', defaultCity: 'Lucknow', stampPaperValue: 'INR 10', metadataPath: '../states/uttar_pradesh/metadata.json' });
