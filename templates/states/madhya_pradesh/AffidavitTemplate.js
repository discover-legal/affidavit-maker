'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_MP', stateName: 'Madhya Pradesh', defaultCourt: 'Family Court, Bhopal', defaultCity: 'Bhopal', stampPaperValue: 'INR 200', metadataPath: '../states/madhya_pradesh/metadata.json' });
