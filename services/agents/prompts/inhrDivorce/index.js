'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Haryana', defaultCourt: 'Family Court, Chandigarh / Gurugram', stampPaperValue: 'INR 10', filingFee: 'INR 500-2,000' });
