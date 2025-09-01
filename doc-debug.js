#!/usr/bin/env node

/**
 * Document Lifecycle Debug Script
 * Tests preview generation, validation, and save functionality
 */

require('dotenv').config();

async function debugDocumentLifecycle() {
  console.log('🔍 Document Lifecycle Debug\n');
  
  const testData = {
    state: 'TX',
    affiantName: 'John Doe',
    caseNumber: '',
    caseType: '',
    county: 'Harris',
    documentType: 'general',
    facts: ['This is a test fact for debugging purposes'],
    documentId: null
  };

  const issues = {
    templateManager: false,
    previewGeneration: false,
    validationDuplication: false,
    saveEndpoint: false,
    generateEndpoint: false
  };

  try {
    // Test 1: Template Manager Functionality
    console.log('📋 Test 1: Template Manager');
    const { StateTemplateManager } = require('./templates/StateTemplateManager');
    const templateManager = new StateTemplateManager();
    
    console.log('✅ StateTemplateManager imported');
    
    // Check if generatePreview method exists and works
    try {
      const previewResult = templateManager.generatePreview(testData);
      console.log('✅ generatePreview method exists');
      console.log('   Preview structure:', {
        hasSections: !!previewResult.sections,
        sectionsType: typeof previewResult.sections,
        sectionsKeys: previewResult.sections ? Object.keys(previewResult.sections) : 'none',
        hasFormatting: !!previewResult.formatting
      });
      issues.templateManager = true;
      
      // Check validation method
      const validation = templateManager.validateDocument(testData);
      console.log('✅ validateDocument method exists');
      console.log('   Validation result:', {
        isValid: validation.isValid,
        errorCount: validation.errors?.length || 0,
        errors: validation.errors
      });
      
    } catch (error) {
      console.log('❌ Template methods failed:', error.message);
    }

    // Test 2: Preview API Endpoint
    console.log('\n🖼️  Test 2: Preview API Endpoint');
    try {
      const response = await fetch('http://localhost:3001/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ affidavitData: testData })
      });
      
      console.log('   Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Preview endpoint working');
        console.log('   Response structure:', {
          success: data.success,
          hasData: !!data.data,
          hasPreview: !!(data.preview || data.data?.preview),
          topLevelKeys: Object.keys(data),
          dataKeys: data.data ? Object.keys(data.data) : 'no data property'
        });
        
        // Check the actual preview content
        const preview = data.preview || data.data?.preview;
        if (preview) {
          console.log('   Preview content:', {
            hasSections: !!preview.sections,
            sectionsCount: preview.sections ? Object.keys(preview.sections).length : 0,
            sectionTypes: preview.sections ? Object.keys(preview.sections) : []
          });
          issues.previewGeneration = true;
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Preview endpoint failed:', errorText);
      }
    } catch (error) {
      console.log('❌ Preview API test failed:', error.message);
    }

    // Test 3: Validation Duplication Check
    console.log('\n🔍 Test 3: Validation Duplication Analysis');
    
    // Track validation calls
    let validationCallCount = 0;
    const originalValidateDocument = templateManager.validateDocument;
    templateManager.validateDocument = function(...args) {
      validationCallCount++;
      console.log(`   📞 Validation call #${validationCallCount}`);
      return originalValidateDocument.apply(this, args);
    };
    
    try {
      // Simulate multiple validation triggers
      console.log('   Triggering validation via different paths...');
      
      // Direct template manager call
      const validation1 = templateManager.validateDocument(testData);
      
      // Via affidavit service
      const AffidavitService = require('./affidavitService');
      const affidavitService = new AffidavitService(templateManager);
      const validation2 = affidavitService.validateAffidavit(testData);
      
      // Via preview generation (might trigger validation)
      const preview = templateManager.generatePreview(testData);
      
      console.log(`   📊 Total validation calls: ${validationCallCount}`);
      
      if (validationCallCount > 2) {
        console.log('❌ Validation duplication detected!');
        console.log('   Expected: 2 calls, Actual:', validationCallCount);
        issues.validationDuplication = false;
      } else {
        console.log('✅ No validation duplication');
        issues.validationDuplication = true;
      }
      
      // Check for duplicate errors
      const errors1 = validation1.errors || [];
      const errors2 = validation2.errors || [];
      const duplicates = errors1.filter(error => 
        errors2.filter(e => e === error).length > 1
      );
      
      if (duplicates.length > 0) {
        console.log('❌ Duplicate error messages found:', duplicates);
      } else {
        console.log('✅ No duplicate error messages');
      }
      
    } catch (error) {
      console.log('❌ Validation test failed:', error.message);
    }

    // Test 4: Save Endpoint
    console.log('\n💾 Test 4: Save Document Endpoint');
    try {
      const saveResponse = await fetch('http://localhost:3001/api/documents/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: null,
          affidavitData: testData
        })
      });
      
      console.log('   Save endpoint status:', saveResponse.status);
      
      if (saveResponse.status === 401) {
        console.log('⚠️  Save requires authentication (expected)');
        issues.saveEndpoint = true; // It exists, just needs auth
      } else if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        console.log('✅ Save endpoint working');
        console.log('   Save response:', saveData.success);
        issues.saveEndpoint = true;
      } else {
        const errorText = await saveResponse.text();
        console.log('❌ Save endpoint failed:', saveResponse.status, errorText);
      }
    } catch (error) {
      console.log('❌ Save API test failed:', error.message);
    }

    // Test 5: Generate Endpoint
    console.log('\n📄 Test 5: Generate Document Endpoint');
    try {
      const generateResponse = await fetch('http://localhost:3001/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affidavitData: testData,
          documentId: 'test-doc-id'
        })
      });
      
      console.log('   Generate endpoint status:', generateResponse.status);
      
      if (generateResponse.status === 401) {
        console.log('⚠️  Generate requires authentication (expected)');
        issues.generateEndpoint = true; // It exists, just needs auth
      } else if (generateResponse.status === 403) {
        console.log('⚠️  Generate requires payment (expected)');
        issues.generateEndpoint = true; // It exists, just needs payment
      } else if (generateResponse.ok) {
        console.log('✅ Generate endpoint working');
        issues.generateEndpoint = true;
      } else {
        const errorText = await generateResponse.text();
        console.log('❌ Generate endpoint failed:', generateResponse.status, errorText);
      }
    } catch (error) {
      console.log('❌ Generate API test failed:', error.message);
    }

    // Test 6: Frontend Data Flow Simulation
    console.log('\n🔄 Test 6: Frontend Data Flow Simulation');
    
    // Simulate how frontend calls preview
    try {
      console.log('   Simulating DocumentContext generatePreview call...');
      
      // This mimics DocumentContext.js generatePreview function
      const payload = { affidavitData: testData };
      const response = await fetch('http://localhost:3001/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check the exact path frontend uses
        const frontendPreview = data.data?.preview || data.preview;
        
        console.log('   Frontend preview path results:', {
          'data.data?.preview': !!data.data?.preview,
          'data.preview': !!data.preview,
          recommendedPath: frontendPreview ? 'Working' : 'Fix needed'
        });
      }
    } catch (error) {
      console.log('   Frontend simulation failed:', error.message);
    }

  } catch (error) {
    console.error('💥 Debug script failed:', error.message);
  }

  // Results Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DOCUMENT LIFECYCLE DEBUG RESULTS');
  console.log('='.repeat(60));
  
  const tests = [
    ['Template Manager Working', issues.templateManager],
    ['Preview Generation Working', issues.previewGeneration], 
    ['No Validation Duplication', issues.validationDuplication],
    ['Save Endpoint Available', issues.saveEndpoint],
    ['Generate Endpoint Available', issues.generateEndpoint]
  ];
  
  tests.forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  // Issue-specific guidance
  console.log('\n💡 SPECIFIC FIXES NEEDED:');
  
  if (!issues.templateManager) {
    console.log('🔧 Template Manager: Check StateTemplateManager methods implementation');
  }
  
  if (!issues.previewGeneration) {
    console.log('🔧 Preview: Fix response structure or frontend data access path');
  }
  
  if (!issues.validationDuplication) {
    console.log('🔧 Validation: Remove duplicate validation calls');
  }
  
  if (!issues.saveEndpoint) {
    console.log('🔧 Save: Check documents route and save method');
  }
  
  if (!issues.generateEndpoint) {
    console.log('🔧 Generate: Check generate route and payment verification');
  }

  console.log('\n🎯 Run this debug script after implementing fixes to verify improvements.');

  return issues;
}

// Handle fetch for Node versions without it
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.error('❌ node-fetch required for API testing');
    console.log('💡 Install: npm install node-fetch');
    process.exit(1);
  }
}

debugDocumentLifecycle().catch(console.error);