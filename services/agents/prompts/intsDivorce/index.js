'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Telangana', defaultCourt: 'Family Court, Hyderabad', stampPaperValue: 'INR 20', filingFee: 'INR 500-3,000' });
