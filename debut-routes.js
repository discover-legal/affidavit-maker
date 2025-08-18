// check-routes.js - Run this to identify problematic route files
console.log('🔍 Checking route files...\n');

const fs = require('fs');
const path = require('path');

const routeFiles = [
  './routes/auth0-webhooks.js',
  './routes/documents.js',
  './routes/auth.js',
  './routes/chat.js',
  './routes/payment.js',
  './routes/templates.js'
];

const checkRoute = (filePath) => {
  const fileName = path.basename(filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${fileName}: File does not exist`);
    return false;
  }
  
  try {
    // Try to require the file
    console.log(`🔍 Checking ${fileName}...`);
    
    // Clear require cache to get fresh import
    delete require.cache[require.resolve(filePath)];
    
    const router = require(filePath);
    
    // Check if it's a function (middleware) or has router methods
    if (typeof router === 'function') {
      console.log(`✅ ${fileName}: Exports a function (middleware/router)`);
      return true;
    } else if (router && typeof router === 'object' && typeof router.use === 'function') {
      console.log(`✅ ${fileName}: Exports a router object`);
      return true;
    } else {
      console.log(`❌ ${fileName}: Does not export a valid router/middleware`);
      console.log(`   Exported type: ${typeof router}`);
      console.log(`   Exported value:`, router);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${fileName}: Import failed`);
    console.log(`   Error: ${error.message}`);
    
    // Show specific error details for common issues
    if (error.message.includes('Cannot resolve module')) {
      console.log(`   💡 Tip: Check import paths in ${fileName}`);
    } else if (error.message.includes('SyntaxError')) {
      console.log(`   💡 Tip: Check syntax in ${fileName}`);
    } else if (error.message.includes('is not defined')) {
      console.log(`   💡 Tip: Check for missing imports in ${fileName}`);
    }
    
    return false;
  }
};

console.log('='.repeat(60));
let allGood = true;

routeFiles.forEach(file => {
  const isOk = checkRoute(file);
  if (!isOk) allGood = false;
  console.log('');
});

console.log('='.repeat(60));

if (allGood) {
  console.log('🎉 All route files look good!');
  console.log('The middleware error might be in a different file.');
  console.log('\n💡 Next steps:');
  console.log('1. Replace your server.js with the fixed version');
  console.log('2. Replace your affidavitService.js with the fixed version');
  console.log('3. Try npm start again');
} else {
  console.log('❌ Found issues with route files');
  console.log('\n💡 Fix the failed route files first, then:');
  console.log('1. Replace your server.js with the fixed version');
  console.log('2. Replace your affidavitService.js with the fixed version');
  console.log('3. Try npm start again');
}

console.log('\n📁 Route files that should exist:');
routeFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check if critical middleware files exist
console.log('\n📁 Critical middleware files:');
const middlewareFiles = [
  './middleware/errorMiddleware.js',
  './middleware/auth0Middleware.js',
  './services/logger.js',
  './templates/StateTemplateManager.js'
];

middlewareFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) {
    console.log(`     💡 This file is required and missing!`);
  }
});

console.log('\n🔧 If you have missing files, you can create minimal versions:');
console.log('Run: node create-minimal-files.js');
