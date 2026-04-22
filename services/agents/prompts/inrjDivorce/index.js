'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Rajasthan', defaultCourt: 'Family Court, Jaipur', stampPaperValue: 'INR 50', filingFee: 'INR 500-2,000' });
