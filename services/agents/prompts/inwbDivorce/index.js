'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'West Bengal', defaultCourt: 'Family Court, Kolkata', stampPaperValue: 'INR 10', filingFee: 'INR 500-2,000' });
