'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_AP', stateName: 'Andhra Pradesh', defaultCourt: 'Family Court, Amaravati', defaultCity: 'Amaravati', stampPaperValue: 'INR 20', metadataPath: '../states/andhra_pradesh/metadata.json' });
