#!/usr/bin/env node
/**
 * OpenAI Failure Diagnostic Script
 * Replicates your exact setup to find why OpenAI calls are failing
 */

require('dotenv').config();

async function diagnosticOpenAIFailures() {
  console.log('🔍 OpenAI Failure Diagnostic\n');
  console.log('Replicating your exact application setup...\n');
  
  const issues = [];
  const fixes = [];

  try {
    // Step 1: Environment Check
    console.log('📋 Step 1: Environment Variables');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      issues.push('Missing OPENAI_API_KEY');
      return { issues, fixes };
    }
    if (!apiKey.startsWith('sk-')) {
      issues.push('Invalid OPENAI_API_KEY format');
      return { issues, fixes };
    }
    console.log('✅ API key format valid');

    // Step 2: Test Raw OpenAI API
    console.log('\n🌐 Step 2: Raw OpenAI API Test');
    try {
      const rawResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      if (!rawResponse.ok) {
        const errorText = await rawResponse.text();
        console.log('❌ Raw API Failed:', rawResponse.status);
        console.log('Error:', errorText);
        
        if (rawResponse.status === 401) {
          issues.push('API Authentication Failed - Check API key');
        } else if (rawResponse.status === 429) {
          issues.push('Rate Limited - Check usage/billing');
        } else if (rawResponse.status === 400) {
          issues.push('Bad Request - Invalid parameters sent to API');
        }
        return { issues, fixes };
      }
      
      console.log('✅ Raw OpenAI API working');
    } catch (error) {
      issues.push(`Network/Connection Error: ${error.message}`);
      return { issues, fixes };
    }

    // Step 3: Test Your OpenAI Client Setup
    console.log('\n🤖 Step 3: Your OpenAI Client Configuration');
    const OpenAI = require('openai');
    
    // EXACT setup from your server.js
    const openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: 45000,
      maxRetries: 0
    });
    console.log('✅ OpenAI client created with your exact config');

    // Test basic chat
    try {
      const simpleTest = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'respond with just OK' }],
        max_tokens: 5
      });
      console.log('✅ OpenAI client basic test:', simpleTest.choices[0].message.content);
    } catch (error) {
      console.log('❌ OpenAI client failed:', error.message);
      issues.push(`OpenAI Client Error: ${error.message}`);
      
      // Check specific error types
      if (error.code === 'insufficient_quota') {
        issues.push('Insufficient quota - Check billing');
      } else if (error.code === 'rate_limit_exceeded') {
        issues.push('Rate limit exceeded');
      } else if (error.message.includes('timeout')) {
        issues.push('Timeout error - Network or server issue');
      }
    }

    // Step 4: Test ResilientService (your wrapper)
    console.log('\n🛡️ Step 4: ResilientOpenAIService Test');
    const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
    
    const resilientService = new ResilientOpenAIService(openaiClient, {
      maxRetries: 3,
      initialRetryDelay: 1000,
      chatTimeout: 45000,
      chatThreshold: 5
    });

    // Check circuit breaker status
    const status = resilientService.getStatus();
    console.log('Circuit Breaker Status:', {
      chatState: status.circuitBreakers.chat.state,
      failures: status.circuitBreakers.chat.failureCount,
      lastFailure: status.circuitBreakers.chat.lastFailureTime
    });

    if (status.circuitBreakers.chat.state === 'OPEN') {
      console.log('⚠️ Circuit breaker is OPEN - resetting for test');
      resilientService.resetCircuitBreakers();
    }

    // Test resilient service chat
    try {
      const resilientTest = await resilientService.chat([
        { role: 'user', content: 'test resilient service' }
      ], {
        max_tokens: 10
      });
      console.log('✅ ResilientService working:', resilientTest.choices[0].message.content);
    } catch (error) {
      console.log('❌ ResilientService failed:', error.message);
      issues.push(`ResilientService Error: ${error.message}`);
    }

    // Step 5: Test State Extraction (the failing part)
    console.log('\n🏛️ Step 5: State Extraction Service Test');
    
    // This is where your logs show JSON parsing errors
    try {
      const testStateMessage = 'texas, my name my jones';
      
      // Test what your current state extractor is sending to OpenAI
      const stateExtractionMessages = [
        {
          role: 'system',
          content: `Extract state from user message. Return JSON with keys: state, confidence, status.`
        },
        {
          role: 'user',
          content: `Message: "${testStateMessage}"`
        }
      ];

      console.log('Testing extraction with these messages:', stateExtractionMessages);

      const extractionTest = await resilientService.chat(stateExtractionMessages, {
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      console.log('✅ State extraction API call succeeded');
      console.log('Response:', extractionTest.choices[0].message.content);

      // Test JSON parsing
      try {
        const parsed = JSON.parse(extractionTest.choices[0].message.content);
        console.log('✅ JSON parsing successful:', parsed);
      } catch (jsonError) {
        console.log('❌ JSON parsing failed:', jsonError.message);
        console.log('Raw response:', extractionTest.choices[0].message.content);
        issues.push('LLM not returning valid JSON despite format specification');
      }

    } catch (error) {
      console.log('❌ State extraction test failed:', error.message);
      issues.push(`State Extraction Error: ${error.message}`);
    }

    // Step 6: Test Parameter Filtering
    console.log('\n⚙️ Step 6: Parameter Filtering Test');
    
    // Test what happens when invalid params are passed
    const invalidParams = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
      timeout: 30000,        // INVALID PARAM
      context: { test: true }, // INVALID PARAM
      retryPolicy: {}         // INVALID PARAM
    };

    console.log('Testing with invalid parameters:', Object.keys(invalidParams));

    try {
      // This should fail if parameter filtering isn't working
      const invalidTest = await openaiClient.chat.completions.create(invalidParams);
      console.log('⚠️ OpenAI accepted invalid parameters (should not happen)');
    } catch (error) {
      if (error.message.includes('Unknown parameter') || error.message.includes('invalid parameter')) {
        console.log('❌ OpenAI rejecting invalid parameters:', error.message);
        issues.push('Invalid parameters being sent to OpenAI API');
        fixes.push('Need to filter parameters before sending to OpenAI');
      } else {
        console.log('❌ Different error with invalid params:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    issues.push(`Diagnostic Error: ${error.message}`);
  }

  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  
  if (issues.length === 0) {
    console.log('✅ No issues found - OpenAI should be working!');
    console.log('💡 If you still see failures, the issue might be:');
    console.log('   - Race conditions in concurrent requests');
    console.log('   - Memory pressure causing timeouts');
    console.log('   - Network instability');
  } else {
    console.log('❌ ISSUES FOUND:');
    issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    
    console.log('\n🔧 FIXES NEEDED:');
    fixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
  }

  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Run: node openai_diagnostic.js');
  console.log('2. If issues found, apply the drop-in fixes');
  console.log('3. Reset circuit breaker: GET /api/debug/reset-openai');
  console.log('4. Test with: "texas, my name my jones"');

  return { issues, fixes };
}

// Run diagnostic
if (require.main === module) {
  diagnosticOpenAIFailures()
    .then(result => {
      if (result.issues.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Diagnostic script failed:', error);
      process.exit(1);
    });
}

module.exports = { diagnosticOpenAIFailures };