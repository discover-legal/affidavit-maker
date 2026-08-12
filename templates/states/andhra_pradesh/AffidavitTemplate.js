'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_AP', stateName: 'Andhra Pradesh', defaultCourt: 'Family Court, Vijayawada', defaultCity: 'Vijayawada', stampPaperValue: 'INR 10', metadataPath: '../states/andhra_pradesh/metadata.json' });
