// debug-imports.js - Run this to test all your imports
console.log('🔍 Testing imports...');

try {
  console.log('✅ Testing AffidavitService...');
  const AffidavitService = require('./affidavitService');
  console.log('✅ AffidavitService imported successfully');
  
  console.log('✅ Testing OpenAI...');
  const OpenAI = require('openai');
  console.log('✅ OpenAI imported successfully');
  
  console.log('✅ Testing ResilientOpenAIService...');
  const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
  console.log('✅ ResilientOpenAIService imported successfully');
  
  console.log('✅ Testing logger...');
  const logger = require('./services/logger');
  console.log('✅ Logger imported successfully');
  
  console.log('✅ Testing StateTemplateManager...');
  const { StateTemplateManager } = require('./templates/StateTemplateManager');
  console.log('✅ StateTemplateManager imported successfully');
  
  console.log('✅ Testing middleware...');
  const { errorMiddleware } = require('./middleware/errorMiddleware');
  console.log('✅ Error middleware imported successfully');
  
  // Test service instantiation
  console.log('\n🔧 Testing service instantiation...');
  
  const openaiClient = new OpenAI({
    apiKey: 'dummy-key-for-testing'
  });
  console.log('✅ OpenAI client created');
  
  const openAIService = new ResilientOpenAIService(openaiClient);
  console.log('✅ ResilientOpenAIService instantiated');
  
  const templateManager = new StateTemplateManager();
  console.log('✅ StateTemplateManager instantiated');
  
  const affidavitService = new AffidavitService();
  console.log('✅ AffidavitService instantiated');
  
  console.log('\n🎉 All imports and instantiation tests passed!');
  console.log('Your server should now start without the ReferenceError.');
  
} catch (error) {
  console.error('❌ Import test failed:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.message.includes('Cannot resolve module')) {
    console.log('\n💡 Suggested fixes:');
    console.log('1. npm install openai');
    console.log('2. Check file paths in require() statements');
    console.log('3. Make sure all referenced files exist');
  }
}