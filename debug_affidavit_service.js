#!/usr/bin/env node

/**
 * Fixed Debug Script - Correct Parameter Signature
 */

require('dotenv').config();

async function debugAffidavitService() {
  console.log('🔍 Debugging Affidavit Service (FIXED VERSION)...\n');
  
  try {
    // Test 1: Check environment
    console.log('📋 Test 1: Environment Variables');
    console.log('✅ OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY ? 'Present' : '❌ MISSING');
    console.log('✅ NODE_ENV:', process.env.NODE_ENV || 'development');
    
    // Test 2: Import dependencies
    console.log('\n📦 Test 2: Import Dependencies');
    
    const OpenAI = require('openai');
    console.log('✅ OpenAI imported');
    
    const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
    console.log('✅ ResilientOpenAIService imported');
    
    const AffidavitService = require('./affidavitService');
    console.log('✅ AffidavitService imported');
    
    const { StateTemplateManager } = require('./templates/StateTemplateManager');
    console.log('✅ StateTemplateManager imported');
    
    // Test 3: Create services (same order as server.js)
    console.log('\n🔧 Test 3: Service Creation');
    
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI client created');
    
    const openAIService = new ResilientOpenAIService(openaiClient);
    console.log('✅ ResilientOpenAIService created');
    
    const templateManager = new StateTemplateManager();
    console.log('✅ StateTemplateManager created');
    
    // Set global (like in server.js)
    global.openAIService = openAIService;
    console.log('✅ Global openAIService set');
    
    const affidavitService = new AffidavitService(templateManager);
    console.log('✅ AffidavitService created');
    
    // Test 4: Check internal service initialization
    console.log('\n🔍 Test 4: Internal Service Check');
    console.log('   • affidavitService.openAIService:', !!affidavitService.openAIService);
    console.log('   • affidavitService.templateManager:', !!affidavitService.templateManager);
    console.log('   • global.openAIService:', !!global.openAIService);
    
    if (!affidavitService.openAIService) {
      console.log('❌ PROBLEM FOUND: affidavitService.openAIService is null/undefined');
      console.log('   This is why your app fails with "No response received"');
      return;
    }
    
    // Test 5: Test the exact method that's failing (FIXED VERSION)
    console.log('\n🧪 Test 5: Test processMessage Method (CORRECTED PARAMETERS)');
    
    const testMessage = 'My name is John Smith and I live in Texas. I need help with a custody affidavit.';
    const testHistory = [
      {
        type: 'bot',
        content: 'Welcome to the Affidavit Maker! I\'ll help you create a legally valid affidavit. Let\'s get started! Please tell me your full name and what state you\'re in (Texas, Utah, or Arizona).'
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
    
    console.log('   📤 Calling processMessage with CORRECT parameters:');
    console.log('   • message:', `"${testMessage}"`);
    console.log('   • historyLength:', testHistory.length);
    console.log('   • affidavitData keys:', Object.keys(testAffidavitData));
    console.log('   • userId:', 4);
    console.log('   • sessionId:', 'test_session');
    
    // ✅ FIXED: Use correct parameter signature
    const result = await affidavitService.processMessage(
      testMessage,        // ✅ Just the string message
      testHistory,        // ✅ Just the history array  
      testAffidavitData,  // ✅ Just the affidavit object
      4,                  // ✅ Just the user ID
      'test_session'      // ✅ Just the session ID
    );
    
    console.log('\n   📥 Result received:', {
      success: result?.success,
      hasResponse: !!result?.response,
      responseLength: result?.response?.length || 0,
      hasExtractedName: !!result?.extractedName,
      hasExtractedState: !!result?.extractedState,
      factsCount: result?.extractedFacts?.length || 0,
      error: result?.error
    });
    
    if (result?.success !== false) {
      console.log('\n   🎉 SUCCESS! processMessage is working correctly!');
      if (result?.response) {
        console.log('   📝 AI Response:', result.response.substring(0, 150) + '...');
      }
      if (result?.extractedName) {
        console.log('   👤 Extracted Name:', result.extractedName);
      }
      if (result?.extractedState) {
        console.log('   📍 Extracted State:', result.extractedState);
      }
      if (result?.extractedFacts?.length > 0) {
        console.log('   📋 Extracted Facts:', result.extractedFacts.length);
      }
    } else {
      console.log('\n   ❌ STILL FAILING!');
      console.log('   🔍 Error details:', result?.error || 'No error message');
    }
    
    // Test 6: Test with minimal message
    console.log('\n🧪 Test 6: Minimal Message Test');
    const minimalResult = await affidavitService.processMessage(
      'texas',
      [],
      {},
      4,
      'test_minimal'
    );
    
    console.log('   📥 Minimal test result:', {
      success: minimalResult?.success !== false,
      hasResponse: !!minimalResult?.response,
      error: minimalResult?.error
    });
    
  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error('📚 Stack trace:', error.stack);
    
    // Specific error guidance
    if (error.message.includes('Cannot find module')) {
      console.log('\n💡 Missing dependency. Try: npm install');
    } else if (error.message.includes('ResilientOpenAIService')) {
      console.log('\n💡 Check if ./services/ResilientOpenAIService.js exists');
    } else if (error.message.includes('processMessage')) {
      console.log('\n💡 Method signature mismatch in processMessage');
    } else if (error.message.includes('OpenAI')) {
      console.log('\n💡 OpenAI API issue. Check your API key and internet connection');
    }
  }
}

// Check Node.js version
if (parseInt(process.version.slice(1).split('.')[0]) < 16) {
  console.error('❌ This script requires Node.js 16 or higher');
  process.exit(1);
}

console.log('🚀 Starting fixed debug script...\n');
debugAffidavitService();