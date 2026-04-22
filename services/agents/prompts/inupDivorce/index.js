'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Uttar Pradesh', defaultCourt: 'Family Court, Lucknow', stampPaperValue: 'INR 10', filingFee: 'INR 500-2,000' });
