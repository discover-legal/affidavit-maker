// debug-openai.js - Run this to debug OpenAI setup
require('dotenv').config();

console.log('🔍 Debugging OpenAI Setup...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  console.log('  OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY.substring(0, 7) + '...');
  console.log('  OPENAI_API_KEY length:', process.env.OPENAI_API_KEY.length);
}
console.log('');

// Check if openai package is available
console.log('📦 Package Check:');
try {
  const openaiPackage = require('openai/package.json');
  console.log('  ✅ OpenAI package found, version:', openaiPackage.version);
} catch (error) {
  // Try alternative check
  try {
    require('openai');
    console.log('  ✅ OpenAI package found (version check failed but import works)');
  } catch (importError) {
    console.log('  ❌ OpenAI package not found:', importError.message);
    console.log('  💡 Run: npm install openai');
    process.exit(1);
  }
}

// Try to import OpenAI
console.log('📥 Import Check:');
try {
  const { OpenAI } = require('openai');
  console.log('  ✅ OpenAI import successful');
  
  // Try to create instance
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('  ✅ OpenAI instance created successfully');
      
      // Try a simple API call (optional)
      console.log('\n🌐 API Test (optional):');
      console.log('  Testing API connection...');
      
      openai.models.list()
        .then(() => {
          console.log('  ✅ API connection successful!');
        })
        .catch((error) => {
          console.log('  ❌ API connection failed:', error.message);
          if (error.message.includes('401')) {
            console.log('  💡 Check your API key - it might be invalid');
          } else if (error.message.includes('quota')) {
            console.log('  💡 You might have exceeded your API quota');
          }
        });
        
    } catch (error) {
      console.log('  ❌ Failed to create OpenAI instance:', error.message);
    }
  } else {
    console.log('  ⚠️  No API key provided, skipping instance creation');
  }
  
} catch (error) {
  console.log('  ❌ OpenAI import failed:', error.message);
}

// Check .env file location
console.log('\n📁 File Check:');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('  ✅ .env file found at:', envPath);
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasOpenAI = envContent.includes('OPENAI_API_KEY');
    console.log('  OPENAI_API_KEY in .env file:', hasOpenAI ? '✅ Yes' : '❌ No');
    
    if (hasOpenAI) {
      const lines = envContent.split('\n');
      const openaiLine = lines.find(line => line.startsWith('OPENAI_API_KEY'));
      if (openaiLine) {
        const isCommented = openaiLine.trim().startsWith('#');
        console.log('  Line is commented out:', isCommented ? '❌ Yes' : '✅ No');
        console.log('  Line content:', openaiLine.substring(0, 30) + '...');
      }
    }
  } catch (error) {
    console.log('  ❌ Could not read .env file:', error.message);
  }
} else {
  console.log('  ❌ .env file not found at:', envPath);
  console.log('  💡 Create a .env file with your OPENAI_API_KEY');
}

console.log('\n🏁 Debug complete!');
