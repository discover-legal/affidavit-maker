'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Punjab', defaultCourt: 'Family Court, Chandigarh / Ludhiana', stampPaperValue: 'INR 15', filingFee: 'INR 500-2,000' });
