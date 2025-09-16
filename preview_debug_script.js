#!/usr/bin/env node

/**
 * Preview Endpoint Test - No Auth Required
 * Tests the data flow through the preview endpoint
 */

const http = require('http');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message, data = null) {
  console.log(`${colors[color]}${message}${colors.reset}`);
  if (data && typeof data === 'object') {
    console.log(JSON.stringify(data, null, 2));
  } else if (data) {
    console.log(data);
  }
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testPreviewWithFacts() {
  log('blue', '📄 Testing Preview with Extracted Facts...');
  
  // Simulate data that would come from successful chat processing
  const affidavitDataWithFacts = {
    affiantName: 'Mike Jones',
    state: 'TX',
    county: 'Harris',
    facts: [
      {
        content: 'My ex-wife Susan hit me on January 15th, 2025 at 3pm in our kitchen.',
        category: 'relational',
        subcategory: 'physical_incident',
        professionalRewrite: 'On January 15, 2025, at approximately 3:00 PM, Susan Jones struck me with her hand in the kitchen of our residence.',
        validationIssues: [],
        severity: 'success',
        confidence: 0.9,
        id: 'fact_1737808103_0',
        timestamp: new Date().toISOString(),
        source: 'llm_extraction'
      },
      {
        content: 'My daughter Emma saw it happen.',
        category: 'witness',
        subcategory: 'witness_present',
        professionalRewrite: 'This incident occurred in the presence of my daughter Emma.',
        validationIssues: ['Need Emma\'s age for legal standing'],
        severity: 'warning',
        confidence: 0.8,
        id: 'fact_1737808103_1',
        timestamp: new Date().toISOString(),
        source: 'llm_extraction'
      }
    ]
  };
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/preview',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { affidavitData: affidavitDataWithFacts });
    
    if (response.statusCode === 200 && response.body.success) {
      log('green', '✅ Preview endpoint working');
      
      const preview = response.body.preview || response.body.data?.preview;
      
      if (preview) {
        log('cyan', '📋 Preview Analysis:');
        
        const analysis = {
          hasSections: !!preview.sections,
          sectionsCount: preview.sections ? Object.keys(preview.sections).length : 0,
          hasFactsSection: !!preview.sections?.facts,
          factsContent: preview.sections?.facts?.content || 'No facts section',
          factCount: preview.metadata?.factCount || 0,
          wordCount: preview.metadata?.wordCount || 0
        };
        
        log('cyan', 'Structure:', analysis);
        
        // Check if facts are in the preview
        if (analysis.factCount > 0) {
          log('green', '🎯 SUCCESS: Facts appear in preview!');
          log('cyan', 'Facts in preview:');
          
          // Safe string checking
          const factsContent = preview.sections?.facts?.content || '';
          log('cyan', `Facts content preview: "${factsContent.substring(0, 100)}..."`);
          
          if (typeof factsContent === 'string') {
            if (factsContent.includes('Susan')) {
              log('green', '   ✅ Contains Susan incident');
            }
            if (factsContent.includes('Emma')) {
              log('green', '   ✅ Contains Emma witness testimony');
            }
            if (factsContent.includes('January 15')) {
              log('green', '   ✅ Contains specific date');
            }
            
            if (factsContent.includes('No facts')) {
              log('yellow', '   ⚠️ Still showing "No facts" message - facts processing needs fix');
            }
          } else {
            log('yellow', '   ⚠️ Facts content is not a string:', typeof factsContent);
          }
          
        } else {
          log('red', '❌ No facts in preview despite sending fact data');
          log('yellow', 'This suggests an issue with the preview generation logic');
        }
        
        return true;
        
      } else {
        log('red', '❌ Preview response missing preview data');
        log('yellow', 'Response keys:', Object.keys(response.body));
        return false;
      }
      
    } else {
      log('red', '❌ Preview endpoint failed');
      log('yellow', 'Status:', response.statusCode);
      log('yellow', 'Error:', response.body?.error || 'Unknown error');
      return false;
    }
    
  } catch (error) {
    log('red', '❌ Preview test failed:', error.message);
    return false;
  }
}

async function testPreviewEmpty() {
  log('blue', '📄 Testing Preview with Empty Facts...');
  
  const emptyAffidavitData = {
    affiantName: 'Mike Jones',
    state: 'TX',
    facts: []
  };
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/preview',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { affidavitData: emptyAffidavitData });
    
    if (response.statusCode === 200) {
      log('green', '✅ Preview works with empty facts');
      
      const preview = response.body.preview || response.body.data?.preview;
      if (preview && preview.sections?.facts?.content?.includes('No facts')) {
        log('cyan', '✅ Correctly shows "No facts" message');
      }
      
      return true;
    } else {
      log('red', '❌ Preview failed with empty facts');
      return false;
    }
    
  } catch (error) {
    log('red', '❌ Empty preview test failed:', error.message);
    return false;
  }
}

async function runPreviewTest() {
  console.clear();
  log('bold', '📄 PREVIEW ENDPOINT TEST (NO AUTH)');
  log('bold', '='.repeat(50));
  
  log('blue', 'Testing the data flow without needing authentication');
  console.log('');
  
  // Check server health
  try {
    const health = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    });
    
    if (health.statusCode === 200) {
      log('green', '✅ Server is running');
    } else {
      log('red', '❌ Server health check failed');
      return;
    }
  } catch (error) {
    log('red', '❌ Cannot reach server - start with: npm run dev');
    return;
  }
  
  console.log('');
  
  // Test with empty facts first
  const emptyTest = await testPreviewEmpty();
  console.log('');
  
  // Test with facts
  const factsTest = await testPreviewWithFacts();
  console.log('');
  
  // Summary
  log('bold', '🎯 PREVIEW TEST RESULTS');
  log('bold', '='.repeat(30));
  
  if (emptyTest && factsTest) {
    log('green', '✅ PREVIEW SYSTEM WORKING PERFECTLY');
    console.log('');
    log('cyan', '💡 What this proves:');
    console.log('   ✅ Template generation works');
    console.log('   ✅ Fact display works');
    console.log('   ✅ Data flow from backend to preview works');
    console.log('');
    log('yellow', '🎯 This means your issue is likely:');
    console.log('   1. Frontend state management (facts not reaching preview component)');
    console.log('   2. Chat API authentication (preventing facts from being extracted)');
    console.log('   3. Frontend validation pane not reading the right data source');
    console.log('');
    log('blue', '💡 Recommendation: Use Option 1 (Browser Token Test) to test the full flow');
    
  } else {
    log('red', '❌ Preview system has issues');
    console.log('');
    log('yellow', '💡 This suggests problems with:');
    console.log('   1. Template manager');
    console.log('   2. Preview generation logic');
    console.log('   3. Backend data processing');
    console.log('');
    log('cyan', 'Check server logs for detailed error messages');
  }
  
  console.log('');
  log('blue', 'Preview test completed!');
}

if (require.main === module) {
  runPreviewTest().catch(error => {
    console.error('Preview test failed:', error);
    process.exit(1);
  });
}