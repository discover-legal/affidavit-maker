'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Bihar', defaultCourt: 'Family Court, Patna', stampPaperValue: 'INR 10', filingFee: 'INR 500-1,500' });
