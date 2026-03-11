'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_HR', stateName: 'Haryana', defaultCourt: 'Family Court, Gurugram', defaultCity: 'Gurugram', stampPaperValue: 'INR 15', metadataPath: '../states/haryana/metadata.json' });
