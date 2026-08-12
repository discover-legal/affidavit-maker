'use strict';
const { createIndiaDivorcePetitionTemplate } = require('../../core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePetitionTemplate({ stateCode: 'IN_PB', stateName: 'Punjab', defaultCourt: 'Family Court, Ludhiana', defaultCity: 'Ludhiana', stampPaperValue: 'INR 15', metadataPath: '../states/punjab/metadata.json' });
