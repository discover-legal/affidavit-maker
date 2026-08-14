'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_WB', stateName: 'West Bengal', defaultCourt: 'Family Court, Calcutta', defaultCity: 'Kolkata', stampPaperValue: 'INR 10', metadataPath: '../states/west_bengal/metadata.json' });
