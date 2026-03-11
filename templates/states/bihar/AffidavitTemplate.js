'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_BR', stateName: 'Bihar', defaultCourt: 'Family Court, Patna', defaultCity: 'Patna', stampPaperValue: 'INR 100', metadataPath: '../states/bihar/metadata.json' });
