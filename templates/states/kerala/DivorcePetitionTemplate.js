'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_KL', stateName: 'Kerala', defaultCourt: 'Family Court, Ernakulam', defaultCity: 'Ernakulam', stampPaperValue: 'INR 50', metadataPath: '../states/kerala/metadata.json' });
