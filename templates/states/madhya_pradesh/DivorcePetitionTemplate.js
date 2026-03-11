'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_MP', stateName: 'Madhya Pradesh', defaultCourt: 'Family Court, Bhopal', defaultCity: 'Bhopal', stampPaperValue: 'INR 200', metadataPath: '../states/madhya_pradesh/metadata.json' });
