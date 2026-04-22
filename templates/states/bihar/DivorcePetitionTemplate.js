'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_BR', stateName: 'Bihar', defaultCourt: 'Family Court, Patna', defaultCity: 'Patna', stampPaperValue: 'INR 10', metadataPath: '../states/bihar/metadata.json' });
