#!/usr/bin/env node

/**
 * Debug Response Structure - See exactly what's in the preview response
 */

const http = require('http');

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

async function debugResponseStructure() {
  console.log('🔍 DEBUGGING PREVIEW RESPONSE STRUCTURE');
  console.log('='.repeat(50));
  
  const testData = {
    affidavitData: {
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
          confidence: 0.9
        },
        {
          content: 'My daughter Emma saw it happen.',
          category: 'witness',
          subcategory: 'witness_present',
          professionalRewrite: 'This incident occurred in the presence of my daughter Emma.',
          validationIssues: ['Need Emma\'s age for legal standing'],
          severity: 'warning',
          confidence: 0.8
        }
      ]
    }
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
    }, testData);
    
    if (response.statusCode === 200) {
      console.log('✅ Response received');
      console.log('\n📊 TOP-LEVEL RESPONSE STRUCTURE:');
      console.log('Keys:', Object.keys(response.body));
      
      // Navigate through the response structure
      if (response.body.preview) {
        console.log('\n📋 PREVIEW STRUCTURE:');
        console.log('Preview keys:', Object.keys(response.body.preview));
        
        if (response.body.preview.sections) {
          console.log('\n📝 SECTIONS STRUCTURE:');
          console.log('Section keys:', Object.keys(response.body.preview.sections));
          
          if (response.body.preview.sections.facts) {
            console.log('\n🎯 FACTS SECTION DETAILED:');
            const factsSection = response.body.preview.sections.facts;
            console.log('Facts section type:', typeof factsSection);
            console.log('Facts section keys:', Object.keys(factsSection));
            console.log('Facts content type:', typeof factsSection.content);
            console.log('Facts content length:', factsSection.content?.length || 'no length');
            console.log('Facts content value:', JSON.stringify(factsSection.content));
            console.log('Facts content preview:', factsSection.content?.substring(0, 200) || 'no content');
          } else {
            console.log('❌ No facts section found');
          }
        } else {
          console.log('❌ No sections found in preview');
        }
        
        if (response.body.preview.metadata) {
          console.log('\n📊 METADATA:');
          console.log('Metadata:', response.body.preview.metadata);
        }
      } else {
        console.log('❌ No preview property in response');
      }
      
      // Also check alternative response structures
      if (response.body.data) {
        console.log('\n📋 ALTERNATIVE: DATA STRUCTURE:');
        console.log('Data keys:', Object.keys(response.body.data));
      }
      
      console.log('\n🔍 FULL RESPONSE (truncated):');
      console.log(JSON.stringify(response.body, null, 2).substring(0, 1000) + '...');
      
    } else {
      console.log('❌ Bad response:', response.statusCode);
      console.log('Body:', response.body);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

debugResponseStructure();