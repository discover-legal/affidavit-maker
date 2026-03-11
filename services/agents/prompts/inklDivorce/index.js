'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Kerala', defaultCourt: 'Family Court, Ernakulam (Kochi)', stampPaperValue: 'INR 50', filingFee: 'INR 500-3,000' });
