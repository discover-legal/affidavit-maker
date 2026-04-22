'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Andhra Pradesh', defaultCourt: 'Family Court, Amaravati / Visakhapatnam', stampPaperValue: 'INR 10', filingFee: 'INR 500-3,000' });
