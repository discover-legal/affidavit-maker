'use strict';
const { createIndiaAffidavitTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaAffidavitTemplate({ stateCode: 'IN_PB', stateName: 'Punjab', defaultCourt: 'Family Court, Ludhiana', defaultCity: 'Ludhiana', stampPaperValue: 'INR 15', metadataPath: '../states/punjab/metadata.json' });
