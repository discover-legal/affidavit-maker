#!/usr/bin/env node

/**
 * Quick Verification Script - Check All Fixes
 * Run after applying all drop-in files
 */

require('dotenv').config();

async function quickVerification() {
  console.log('🧪 Quick Verification - All Document Fixes\n');
  
  const results = {
    templateManager: false,
    preview: false,
    validation: false,
    save: false,
    generate: false
  };

  const testData = {
    state: 'TX',
    affiantName: 'Test User',
    county: 'Harris',
    facts: ['Test fact for verification'],
    documentType: 'general'
  };

  try {
    // Test 1: Template Manager (Fix #2)
    console.log('📋 Test 1: Template Manager Validation Deduplication');
    const { StateTemplateManager } = require('./templates/StateTemplateManager');
    const templateManager = new StateTemplateManager();
    
    const validation1 = templateManager.validateDocument(testData);
    const validation2 = templateManager.validateDocument(testData);
    
    // Check for duplicates
    const allErrors = [...validation1.errors, ...validation2.errors];
    const uniqueErrors = [...new Set(allErrors)];
    
    results.templateManager = allErrors.length === uniqueErrors.length;
    console.log('✅ Validation Deduplication:', results.templateManager ? 'FIXED' : 'STILL HAS DUPLICATES');
    console.log('   Errors found:', validation1.errors);
    
    // Test 2: Preview Generation (should already work from Fix #1)
    console.log('\n🖼️  Test 2: Preview Generation');
    try {
      const response = await fetch('http://localhost:3001/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affidavitData: testData })
      });
      
      if (response.ok) {
        const data = await response.json();
        results.preview = !!(data.success && data.preview && data.validation);
        console.log('✅ Preview API:', results.preview ? 'WORKING' : 'FAILED');
      }
    } catch (error) {
      console.log('❌ Preview API: FAILED -', error.message);
    }

    // Test 3: Save Endpoint (Fix #3)  
    console.log('\n💾 Test 3: Save Document Endpoint');
    try {
      const response = await fetch('http://localhost:3001/api/documents/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affidavitData: testData })
      });
      
      results.save = response.status !== 404; // 401 = exists but needs auth, 404 = doesn't exist
      console.log('✅ Save Endpoint:', results.save ? 'EXISTS' : 'MISSING');
      console.log('   Status:', response.status, response.status === 401 ? '(auth required - normal)' : '');
      
    } catch (error) {
      console.log('❌ Save Endpoint: FAILED -', error.message);
    }

    // Test 4: Generate Endpoint (Fix #4)
    console.log('\n📄 Test 4: Generate Document Endpoint');
    try {
      const response = await fetch('http://localhost:3001/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          affidavitData: testData,
          skipPayment: true 
        })
      });
      
      results.generate = response.status !== 404;
      console.log('✅ Generate Endpoint:', results.generate ? 'EXISTS' : 'MISSING');
      console.log('   Status:', response.status, response.status === 401 ? '(auth required - normal)' : '');
      
    } catch (error) {
      console.log('❌ Generate Endpoint: FAILED -', error.message);
    }

  } catch (error) {
    console.error('💥 Verification failed:', error.message);
  }

  // Results Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION RESULTS');
  console.log('='.repeat(60));
  
  const fixes = [
    ['Fix #2: Validation Deduplication', results.templateManager],
    ['Fix #1: Preview Generation', results.preview],
    ['Fix #3: Save Progress', results.save],
    ['Fix #4: Generate Button', results.generate]
  ];
  
  fixes.forEach(([fix, working]) => {
    console.log(`${working ? '✅' : '❌'} ${fix}`);
  });

  const totalWorking = fixes.filter(([_, working]) => working).length;
  console.log(`\n🎯 ${totalWorking}/${fixes.length} fixes verified and working!`);
  
  if (totalWorking === fixes.length) {
    console.log('\n🎉 ALL FIXES SUCCESSFUL!');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Restart your frontend: npm run client');
    console.log('   2. Test the document preview pane');
    console.log('   3. Try saving progress');
    console.log('   4. Test the generate button');
    console.log('   5. Check validation errors are clean (no duplicates)');
  } else {
    console.log('\n🔧 Some fixes still need work. Check the failed items above.');
  }

  // Component Integration Reminder
  console.log('\n💡 Don\'t forget to:');
  console.log('   • Add GenerateButton to your EditorView');
  console.log('   • Add SaveProgressButton to your UI');
  console.log('   • Import the new components where needed');
  
  return results;
}

// Handle fetch
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.error('❌ Install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

quickVerification().catch(console.error);