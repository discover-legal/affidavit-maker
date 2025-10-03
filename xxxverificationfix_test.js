// test-fixes.js - Run this to verify all fixes are working
// Place in project root and run: node test-fixes.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying fix installation...\n');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

// Helper functions
function checkFileExists(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}`);
    checks.passed++;
    return true;
  } else {
    console.log(`❌ ${description} - FILE NOT FOUND`);
    checks.failed++;
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${description} - FILE NOT FOUND`);
    checks.failed++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    console.log(`✅ ${description}`);
    checks.passed++;
    return true;
  } else {
    console.log(`❌ ${description} - PATTERN NOT FOUND`);
    checks.failed++;
    return false;
  }
}

function checkFileDoesNotContain(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${description} - FILE NOT FOUND`);
    checks.warnings++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes(searchString)) {
    console.log(`✅ ${description}`);
    checks.passed++;
    return true;
  } else {
    console.log(`❌ ${description} - OLD CODE STILL PRESENT`);
    checks.failed++;
    return false;
  }
}

// Run checks
console.log('📁 Checking file existence...\n');

checkFileExists('utils/factNormalizer.js', 'Created utils/factNormalizer.js');

console.log('\n📝 Checking factNormalizer.js content...\n');

checkFileContains(
  'utils/factNormalizer.js',
  'function normalizeFact(fact)',
  'factNormalizer has normalizeFact function'
);

checkFileContains(
  'utils/factNormalizer.js',
  'function prepareFactsForStorage',
  'factNormalizer has prepareFactsForStorage function'
);

checkFileContains(
  'utils/factNormalizer.js',
  'function extractFactContent',
  'factNormalizer has extractFactContent function'
);

console.log('\n🔧 Checking ResilientOpenAIService.js...\n');

checkFileContains(
  'services/ResilientOpenAIService.js',
  'createFallbackStream()',
  'ResilientOpenAIService has createFallbackStream method'
);

checkFileContains(
  'services/ResilientOpenAIService.js',
  'const sentences = fallbackContent.match(/[^.!?\\n]+[.!?\\n]+/g)',
  'createFallbackStream uses sentence-based streaming'
);

checkFileDoesNotContain(
  'services/ResilientOpenAIService.js',
  'for (let i = 0; i < words.length; i += 2)',
  'Old word-chunking code removed'
);

console.log('\n⚛️  Checking ValidationSidebar.js...\n');

checkFileContains(
  'client/src/components/ValidationSidebar.js',
  'const saveEditedFact = async () => {',
  'ValidationSidebar has async saveEditedFact'
);

checkFileContains(
  'client/src/components/ValidationSidebar.js',
  'await saveDocument();',
  'ValidationSidebar triggers immediate save'
);

checkFileContains(
  'client/src/components/ValidationSidebar.js',
  'const getFactMetadata = (fact) => {',
  'ValidationSidebar has getFactMetadata function'
);

checkFileContains(
  'client/src/components/ValidationSidebar.js',
  'export default ValidationSidebar;',
  'ValidationSidebar is complete (has export)'
);

console.log('\n🛣️  Checking routes/documents.js...\n');

checkFileContains(
  'routes/documents.js',
  "require('../utils/factNormalizer')",
  'routes/documents.js imports factNormalizer'
);

checkFileContains(
  'routes/documents.js',
  'prepareFactsForStorage',
  'Save endpoint uses prepareFactsForStorage'
);

checkFileContains(
  'routes/documents.js',
  'prepareFactsForDisplay',
  'Preview enhancement uses prepareFactsForDisplay'
);

checkFileContains(
  'routes/documents.js',
  'formatted: enhanced.sections.facts.content',
  'Preview keeps formatted string for PDF'
);

checkFileContains(
  'routes/documents.js',
  'items: prepareFactsForDisplay',
  'Preview adds items array for UI'
);

console.log('\n📄 Checking StateTemplateManager.js...\n');

checkFileContains(
  'templates/StateTemplateManager.js',
  "require('../utils/factNormalizer')",
  'StateTemplateManager imports factNormalizer'
);

checkFileContains(
  'templates/StateTemplateManager.js',
  'extractFactContent',
  'processFactsSection uses extractFactContent'
);

console.log('\n✔️  Checking enhancedFactValidationService.js...\n');

checkFileContains(
  'services/enhancedFactValidationService.js',
  'function ensureArray(value)',
  'Validation service has ensureArray helper'
);

checkFileContains(
  'services/enhancedFactValidationService.js',
  'languageIssues: ensureArray',
  'buildCriticalResult uses ensureArray'
);

checkFileContains(
  'services/enhancedFactValidationService.js',
  'issues: ensureArray',
  'Validation results include issues array'
);

checkFileContains(
  'services/enhancedFactValidationService.js',
  'suggestions: ensureArray',
  'Validation results include suggestions array'
);

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${checks.passed}`);
console.log(`❌ Failed: ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);
console.log('='.repeat(50));

if (checks.failed === 0) {
  console.log('\n🎉 SUCCESS! All fixes are properly installed.\n');
  console.log('Next steps:');
  console.log('1. Restart your server: npm run dev');
  console.log('2. Clear browser cache and localStorage');
  console.log('3. Test manually in the UI');
  console.log('4. Create a new document and test fact saving\n');
  process.exit(0);
} else {
  console.log('\n⚠️  ISSUES DETECTED! Please review failed checks above.\n');
  console.log('Common fixes:');
  console.log('- Make sure you created utils/factNormalizer.js');
  console.log('- Check that you replaced ENTIRE functions, not just parts');
  console.log('- Verify imports were added to file tops');
  console.log('- Ensure ensureArray() is OUTSIDE the class definition\n');
  process.exit(1);
}
