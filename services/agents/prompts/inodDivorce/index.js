'use strict';
const { createIndiaDivorcePrompts } = require('../../../../templates/core/IndiaTemplateFactory');
module.exports = createIndiaDivorcePrompts({ stateName: 'Odisha', defaultCourt: 'Family Court, Bhubaneswar / Cuttack', stampPaperValue: 'INR 15', filingFee: 'INR 500-1,500' });
