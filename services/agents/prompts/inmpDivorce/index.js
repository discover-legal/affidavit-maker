'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Madhya Pradesh', defaultCourt: 'Family Court, Bhopal / Indore', stampPaperValue: 'INR 200', filingFee: 'INR 500-2,000' });
