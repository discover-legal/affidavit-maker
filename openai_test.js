#!/usr/bin/env node

/**

 * Enhanced OpenAI Chain Debug Script
 * Follows the exact same path as your running application
 * to pinpoint where the OpenAI connection fails
 */

require('dotenv').config();


async function debugOpenAIChain() {
  console.log('🔍 Enhanced OpenAI Chain Debug\n');
  console.log('Following the exact same path as your running application...\n');
  
  const results = {
    apiKey: false,
    directAPI: false,
    openaiClient: false,
    resilientService: false,
    circuitBreaker: false,
    affidavitService: false,
    fullChain: false
  };
  
  try {
    // Step 1: Check API Key
    console.log('📋 Step 1: Environment Check');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ OPENAI_API_KEY missing');
      return results;
    }
    console.log('✅ API key present:', apiKey.substring(0, 20) + '...');
    results.apiKey = true;
    
    // Step 2: Direct OpenAI API Test (raw fetch)
    console.log('\n🌐 Step 2: Direct OpenAI API Test');
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'AffidavitMaker/1.0'
        },
        timeout: 10000
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Direct API failed:', response.status, errorText);
        
        // Detailed error analysis
        if (response.status === 401) {
          console.log('   🔍 Authentication failed - check your API key');
        } else if (response.status === 429) {
          console.log('   🔍 Rate limited - check your usage/billing');
        } else if (response.status === 403) {
          console.log('   🔍 Forbidden - check API key permissions');
        }
        return results;
      }
      
      const data = await response.json();
      console.log('✅ Direct API working - found', data.data.length, 'models');
      results.directAPI = true;
    } catch (error) {
      console.log('❌ Direct API failed:', error.message);
      if (error.code === 'ENOTFOUND') {
        console.log('   🔍 DNS resolution failed - check internet connection');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   🔍 Request timeout - check firewall/proxy');
      }
      return results;
    }
    
    // Step 3: OpenAI Client Creation (same as your app)
    console.log('\n🤖 Step 3: OpenAI Client Creation');
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: 45000,
      maxRetries: 0 // We'll handle retries in ResilientService
    });
    console.log('✅ OpenAI client created');
    results.openaiClient = true;
    
    // Step 4: Test Client with Simple Request
    console.log('\n💬 Step 4: Testing OpenAI Client');
    try {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Test connection - respond with just 'OK'" }],
        max_tokens: 5
        // ✅ REMOVED: timeout - not a valid API parameter
      });
      console.log('✅ OpenAI client working:', completion.choices[0].message.content.trim());
      results.openaiClient = true;
    } catch (error) {
      console.log('❌ OpenAI client failed:', error.message);
      console.log('   🔍 Error code:', error.code);
      console.log('   🔍 Error type:', error.type);
      return results;
    }
    
    // Step 5: ResilientOpenAIService (your wrapper)
    console.log('\n🛡️  Step 5: ResilientOpenAIService Creation');
    const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
    const resilientService = new ResilientOpenAIService(openaiClient, {
      maxRetries: 3,
      initialRetryDelay: 1000,
      chatTimeout: 45000,
      chatThreshold: 5, // Same as your logs show
      resetTimeout: 120000
    });
    console.log('✅ ResilientOpenAIService created');
    results.resilientService = true;
    
    // Step 6: Check Circuit Breaker State
    console.log('\n⚡ Step 6: Circuit Breaker Status');
    const status = resilientService.getStatus();
    console.log('   📊 Chat Circuit Breaker:');
    console.log('     - State:', status.circuitBreakers.chat.state);
    console.log('     - Failure Count:', status.circuitBreakers.chat.failureCount);
    console.log('     - Success Count:', status.circuitBreakers.chat.successCount);
    console.log('     - Total Calls:', status.circuitBreakers.chat.metrics.totalCalls);
    console.log('     - Last Failure:', status.circuitBreakers.chat.lastFailureTime ? new Date(status.circuitBreakers.chat.lastFailureTime) : 'None');
    
    if (status.circuitBreakers.chat.state === 'OPEN') {
      console.log('❌ Circuit breaker is OPEN - this is why your app uses fallbacks!');
      console.log('🔧 Resetting circuit breaker for test...');
      resilientService.resetCircuitBreakers();
    }
    results.circuitBreaker = true;
    
    // Step 7: Test ResilientService Chat
    console.log('\n💬 Step 7: Testing ResilientService Chat Method');
    try {
      const testMessages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "texas" }
      ];
      
      console.log('   📤 Calling resilientService.chat()...');
      const chatResult = await resilientService.chat(testMessages, {
        model: "gpt-4",
        max_tokens: 100,
        temperature: 0.7
      });
      
      console.log('✅ ResilientService chat working');
      console.log('   📝 Response:', chatResult.choices[0].message.content.substring(0, 100) + '...');
      results.resilientService = true;
    } catch (error) {
      console.log('❌ ResilientService chat failed:', error.message);
      console.log('   🔍 This is likely where your app starts failing');
      
      // Check if it's a circuit breaker issue
      const newStatus = resilientService.getStatus();
      if (newStatus.circuitBreakers.chat.state === 'OPEN') {
        console.log('   ⚡ Circuit breaker opened during test');
      }
      return results;
    }
    
    // Step 8: AffidavitService Integration (your exact setup)
    console.log('\n📄 Step 8: AffidavitService Integration');
    const { StateTemplateManager } = require('./templates/StateTemplateManager');
    const AffidavitService = require('./affidavitService');
    
    const templateManager = new StateTemplateManager();
    global.openAIService = resilientService; // Same as your server.js
    
    const affidavitService = new AffidavitService(templateManager);
    console.log('✅ AffidavitService created');
    console.log('   🔍 Has openAIService:', !!affidavitService.openAIService);
    console.log('   🔍 Has templateManager:', !!affidavitService.templateManager);
    results.affidavitService = true;
    
    // Step 9: Full Chain Test (exact same call as your routes/chat.js)
    console.log('\n🔗 Step 9: Full Chain Test - Exact Route Replication');
    try {
      const testMessage = 'texas';
      const testHistory = [
        {
          type: 'bot',
          content: "Welcome to the Affidavit Maker! I'll help you create a legally valid affidavit. Let's get started! Please tell me your full name and what state you're in (Texas, Utah, or Arizona)."
        }
      ];
      const testAffidavitData = {
        state: '',
        affiantName: '',
        caseNumber: '',
        caseType: '',
        county: '',
        documentType: 'general',
        facts: [],
        documentId: null
      };
      
      console.log('   📤 Calling affidavitService.processMessage() with exact route parameters...');
      
      // This is the EXACT call from routes/chat.js line ~150
      const result = await affidavitService.processMessage(
        testMessage,
        testHistory,
        testAffidavitData,
        4, // userId from your logs
        'debug_session_test'
      );
      
      console.log('   📥 Result received:', {
        success: result?.success,
        hasResponse: !!result?.response,
        responseLength: result?.response?.length || 0,
        hasError: !!result?.error
      });
      
      if (result?.success && result?.response) {
        console.log('🎉 SUCCESS! Full chain working!');
        console.log('   📝 AI Response:', result.response.substring(0, 150) + '...');
        results.fullChain = true;
      } else {
        console.log('❌ Full chain failed');
        console.log('   🔍 Error:', result?.error || 'No response generated');
        console.log('   🔍 This is the exact issue your app is experiencing');
      }
    } catch (error) {
      console.log('❌ Full chain test failed:', error.message);
      console.log('   📚 Stack trace:', error.stack);
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    console.error('📚 Stack:', error.stack);
  }
  
  // Final Results Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DEBUG RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const steps = [
    ['API Key Present', results.apiKey],
    ['Direct API Working', results.directAPI], 
    ['OpenAI Client OK', results.openaiClient],
    ['ResilientService OK', results.resilientService],
    ['Circuit Breaker OK', results.circuitBreaker],
    ['AffidavitService OK', results.affidavitService],
    ['Full Chain Working', results.fullChain]
  ];
  
  steps.forEach(([step, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${step}`);
  });
  
  // Determine where the issue is
  const lastWorking = steps.findLastIndex(([_, passed]) => passed);
  const firstFailing = steps.findIndex(([_, passed]) => !passed);
  
  if (results.fullChain) {
    console.log('\n🎉 All tests passed! Your OpenAI integration is working correctly.');
    console.log('💡 If your app still fails, the issue might be:');
    console.log('   - Environment differences between test and runtime');
    console.log('   - Different error handling in actual app flow');
    console.log('   - Circuit breaker stuck in OPEN state (reset it)');
  } else if (firstFailing !== -1) {
    console.log(`\n🎯 Issue found at step: ${steps[firstFailing][0]}`);
    console.log('💡 Focus on fixing this step to resolve your app issues.');
    
    if (firstFailing <= 1) {
      console.log('🔧 API/Auth issue - check key, billing, permissions');
    } else if (firstFailing <= 3) {
      console.log('🔧 Client configuration issue - check timeouts, network');
    } else {
      console.log('🔧 Service integration issue - check constructor, dependencies');
    }
  }
  
  console.log('\n🔄 To reset circuit breaker in your running app, visit:');
  console.log('   http://localhost:3001/api/debug/reset-openai');
  
  return results;
}

// Run with Node version check
if (parseInt(process.version.slice(1).split('.')[0]) < 18) {
  console.error('❌ This script requires Node.js 18+ for fetch support');
  console.log('💡 Install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Handle fetch for older Node versions
if (typeof fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    global.fetch = nodeFetch;
  } catch (e) {
    console.error('❌ fetch not available and node-fetch not installed');
    console.log('💡 Install: npm install node-fetch');
    process.exit(1);
  }
}

debugOpenAIChain().catch(console.error);