#!/usr/bin/env node

/**
 * Frontend Preview Debug Script
 * This simulates exactly what your frontend should be doing
 */

async function debugFrontendPreview() {
  console.log('🔍 Debugging Frontend Preview System...\n');

  // Test data matching what we know works from your logs
  const testAffidavitData = {
    state: 'AZ',
    affiantName: 'Mike Jones',
    caseNumber: '',
    caseType: '',
    county: '',
    documentType: 'general',
    facts: [
      { 
        content: 'I have been the primary caregiver for my child for the past 2 years',
        category: 'parental',
        professionalRewrite: 'I have served as the primary caregiver for my minor child for a period of two years.'
      },
      {
        content: 'The other parent has missed visitation multiple times', 
        category: 'relational',
        professionalRewrite: 'The opposing party has failed to appear for scheduled visitation on multiple occasions.'
      },
      {
        content: 'I can provide a safe and stable home environment',
        category: 'witness', 
        professionalRewrite: 'I am able to provide a safe, stable, and nurturing home environment for my child.'
      }
    ],
    documentId: null
  };

  try {
    // Test 1: Check if preview API is accessible
    console.log('📡 Test 1: Preview API Call (matches frontend)');
    
    const response = await fetch('http://localhost:3001/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ affidavitData: testAffidavitData })
    });

    console.log('   Response status:', response.status);
    console.log('   Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      
      console.log('\n📊 Test 2: Response Structure Analysis');
      console.log('   Response keys:', Object.keys(data));
      console.log('   Has success:', !!data.success);
      console.log('   Has preview:', !!data.preview);
      console.log('   Has data.preview:', !!data.data?.preview);
      console.log('   Has error:', !!data.error);
      console.log('   Has fallback:', !!data.fallback);

      // Test the exact paths the frontend uses
      console.log('\n🔍 Test 3: Frontend Data Access Paths');
      
      // Path 1: Direct preview
      const directPreview = data.preview;
      console.log('   data.preview exists:', !!directPreview);
      
      // Path 2: Nested preview
      const nestedPreview = data.data?.preview;
      console.log('   data.data?.preview exists:', !!nestedPreview);
      
      // Path 3: Just data
      const justData = data.data;
      console.log('   data.data exists:', !!justData);

      // Determine which path has actual preview content
      let actualPreview = directPreview || nestedPreview || justData;
      
      if (actualPreview) {
        console.log('\n✅ Test 4: Preview Content Validation');
        console.log('   Has sections:', !!actualPreview.sections);
        console.log('   Sections type:', Array.isArray(actualPreview.sections) ? 'array' : typeof actualPreview.sections);
        
        if (actualPreview.sections) {
          if (typeof actualPreview.sections === 'object' && !Array.isArray(actualPreview.sections)) {
            console.log('   Section keys:', Object.keys(actualPreview.sections));
            
            // Check each section
            Object.entries(actualPreview.sections).forEach(([key, section]) => {
              console.log(`   Section ${key}:`, {
                hasTitle: !!section.title,
                hasContent: !!section.content,
                contentLength: section.content?.length || 0
              });
            });
          }
        }

        // Check metadata
        if (actualPreview.metadata) {
          console.log('   Metadata:', {
            factCount: actualPreview.metadata.factCount,
            stateName: actualPreview.metadata.stateName,
            isComplete: actualPreview.metadata.isComplete
          });
        }

        console.log('\n🎯 Test 5: Frontend Display Requirements');
        
        // Check if this preview would display properly in the frontend
        const wouldDisplay = !!(
          actualPreview.sections && 
          (
            (typeof actualPreview.sections === 'object' && Object.keys(actualPreview.sections).length > 0) ||
            (Array.isArray(actualPreview.sections) && actualPreview.sections.length > 0)
          )
        );
        
        console.log('   Would display in frontend:', wouldDisplay ? '✅ YES' : '❌ NO');
        
        if (!wouldDisplay) {
          console.log('   Issue: Preview sections missing or empty');
        }

      } else {
        console.log('\n❌ Test 4: No Preview Content Found');
        console.log('   Issue: No preview data in any expected path');
      }

    } else {
      const errorText = await response.text();
      console.log('   Error response:', errorText);
    }

    // Test 6: Check browser console issues
    console.log('\n🌐 Test 6: Browser Console Checklist');
    console.log('   Check your browser console for:');
    console.log('   1. Network tab - look for /api/preview calls');
    console.log('   2. Console errors about preview rendering');
    console.log('   3. React component rendering errors');
    console.log('   4. CORS issues or auth failures');

    // Test 7: Component state issues  
    console.log('\n⚛️  Test 7: React Component Issues');
    console.log('   Common frontend preview issues:');
    console.log('   1. Preview state not updating when affidavitData changes');
    console.log('   2. useEffect dependencies missing or incorrect');
    console.log('   3. Preview component not receiving updated props');
    console.log('   4. CSS hiding the preview content');
    console.log('   5. Conditional rendering preventing preview display');

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 FRONTEND DEBUGGING STEPS:');
  console.log('='.repeat(60));
  
  console.log('\n1. BROWSER DEV TOOLS CHECK:');
  console.log('   - Open your app in browser');
  console.log('   - Open Dev Tools (F12)');
  console.log('   - Start a chat and add facts');
  console.log('   - Watch Network tab for /api/preview calls');
  console.log('   - Check Console tab for any errors');

  console.log('\n2. REACT COMPONENT DEBUG:');
  console.log('   - Add console.log in DocumentPreview component');
  console.log('   - Log the preview prop: console.log("Preview:", preview)');
  console.log('   - Log when useEffect runs for preview updates');
  console.log('   - Check if preview state is actually changing');

  console.log('\n3. CSS/LAYOUT CHECK:');
  console.log('   - Inspect the preview container element');
  console.log('   - Check if it has height: 0 or display: none');
  console.log('   - Look for overflow: hidden issues');
  console.log('   - Verify the preview content is in the DOM');

  console.log('\n4. DATA FLOW CHECK:');
  console.log('   - Verify chat updates trigger preview regeneration');
  console.log('   - Check if DocumentContext.generatePreview is called');
  console.log('   - Ensure affidavitData state is actually updating');
  console.log('   - Confirm preview API returns valid data');

  console.log('\n5. QUICK FIX TEST:');
  console.log('   - Try hard-coding preview data in component');
  console.log('   - If that works, issue is with data flow');
  console.log('   - If that fails, issue is with rendering logic');
}

// Handle fetch for Node environments
if (typeof fetch === 'undefined') {
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.log('💡 Install node-fetch: npm install node-fetch');
    console.log('   Or run with Node 18+ which has built-in fetch');
  }
}

debugFrontendPreview().catch(console.error);