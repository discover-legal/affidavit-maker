#!/usr/bin/env node

/**
 * OpenAI Connection Test Script
 * 
 * Tests your OpenAI API connection and key validity
 * Usage: node test-openai.js
 */

require('dotenv').config();

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🔧 Testing OpenAI Connection...\n');
  
  // Check if API key exists
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    console.log('💡 Add it to your .env file: OPENAI_API_KEY=sk-...');
    process.exit(1);
  }
  
  console.log('✅ API key found:', apiKey.substring(0, 20) + '...');
  
  try {
    // Test 1: List models (simple endpoint)
    console.log('\n📋 Test 1: Listing available models...');
    
    const modelsResponse = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!modelsResponse.ok) {
      const error = await modelsResponse.text();
      throw new Error(`Models API failed: ${modelsResponse.status} - ${error}`);
    }
    
    const models = await modelsResponse.json();
    const gptModels = models.data.filter(m => m.id.includes('gpt')).map(m => m.id);
    console.log('✅ Models endpoint working');
    console.log('🤖 Available GPT models:', gptModels.slice(0, 3).join(', '), '...');
    
    // Test 2: Simple chat completion
    console.log('\n💬 Test 2: Testing chat completion...');
    
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Say "Connection test successful!" in exactly those words.'
          }
        ],
        max_tokens: 10,
        temperature: 0
      })
    });
    
    if (!chatResponse.ok) {
      const error = await chatResponse.text();
      throw new Error(`Chat API failed: ${chatResponse.status} - ${error}`);
    }
    
    const chatData = await chatResponse.json();
    const aiMessage = chatData.choices[0].message.content.trim();
    
    console.log('✅ Chat completion working');
    console.log('🤖 AI Response:', aiMessage);
    
    // Test 3: Test with your specific affidavit prompt
    console.log('\n📄 Test 3: Testing affidavit-style prompt...');
    
    const affidavitResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant helping users create legal affidavits. Extract key information from user messages.'
          },
          {
            role: 'user',
            content: 'texas'
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });
    
    if (!affidavitResponse.ok) {
      const error = await affidavitResponse.text();
      throw new Error(`Affidavit test failed: ${affidavitResponse.status} - ${error}`);
    }
    
    const affidavitData = await affidavitResponse.json();
    const affidavitMessage = affidavitData.choices[0].message.content.trim();
    
    console.log('✅ Affidavit-style prompt working');
    console.log('🤖 AI Response:', affidavitMessage.substring(0, 100) + '...');
    
    // Success summary
    console.log('\n🎉 All tests passed! OpenAI connection is working correctly.');
    console.log('\n📊 Connection Summary:');
    console.log(`   • API Key: Valid`);
    console.log(`   • Models endpoint: ✅`);
    console.log(`   • Chat completions: ✅`);
    console.log(`   • GPT-4 access: ✅`);
    
    // Usage info
    const usage = affidavitData.usage;
    if (usage) {
      console.log(`   • Tokens used: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`);
    }
    
  } catch (error) {
    console.error('\n❌ OpenAI connection failed:');
    console.error('   Error:', error.message);
    
    // Common error suggestions
    if (error.message.includes('401')) {
      console.log('\n💡 Suggestions:');
      console.log('   • Check if your API key is correct');
      console.log('   • Verify the key hasn\'t expired');
      console.log('   • Make sure you have credits/billing set up');
    } else if (error.message.includes('429')) {
      console.log('\n💡 Rate limit exceeded. Try again in a moment.');
    } else if (error.message.includes('fetch')) {
      console.log('\n💡 Network issue. Check your internet connection.');
    }
    
    process.exit(1);
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('⚠️  This script requires Node.js 18+ or installing node-fetch');
  console.log('   Alternative: npm install node-fetch');
  process.exit(1);
}

// Run the test
testOpenAI();