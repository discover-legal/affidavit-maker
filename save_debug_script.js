#!/usr/bin/env node

/**
 * Debug Save/Retrieve Issues
 * Run this to find out exactly why saves aren't working
 */

require('dotenv').config();

async function debugSaveIssues() {
  console.log('🔍 Debugging Save/Retrieve Issues...\n');
  
  try {
    // Test data matching what we see in logs
    const testAffidavitData = {
      state: 'AZ',
      affiantName: 'Mike Jones',
      caseNumber: '',
      caseType: '',
      county: '',
      documentType: 'general',
      facts: [
        { content: 'Test fact 1', category: 'witness' },
        { content: 'Test fact 2', category: 'temporal' },
        { content: 'Test fact 3', category: 'financial' }
      ],
      documentId: null
    };

    // Test 1: Check if save route exists and is accessible
    console.log('📤 Test 1: Check Save Route');
    try {
      const response = await fetch('http://localhost:3001/api/documents/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No auth - will get 401 but that's expected
        },
        body: JSON.stringify({
          affidavitData: testAffidavitData
        })
      });
      
      console.log('   Save route status:', response.status);
      if (response.status === 401) {
        console.log('   ✅ Save route exists (requires auth)');
      } else {
        const text = await response.text();
        console.log('   Response:', text);
      }
    } catch (error) {
      console.log('   ❌ Save route not accessible:', error.message);
    }

    // Test 2: Check documents list route
    console.log('\n📋 Test 2: Check Documents List Route');
    try {
      const response = await fetch('http://localhost:3001/api/documents', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // No auth - will get 401 but that's expected
        }
      });
      
      console.log('   Documents list status:', response.status);
      if (response.status === 401) {
        console.log('   ✅ Documents route exists (requires auth)');
      } else {
        const text = await response.text();
        console.log('   Response:', text);
      }
    } catch (error) {
      console.log('   ❌ Documents route not accessible:', error.message);
    }

    // Test 3: Database connection check
    console.log('\n🗄️  Test 3: Database Connection');
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      
      const result = await pool.query('SELECT NOW()');
      console.log('   ✅ Database connected');
      
      // Check if documents table exists
      const tableCheck = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'documents'
        ORDER BY ordinal_position
      `);
      
      if (tableCheck.rows.length > 0) {
        console.log('   ✅ Documents table exists with columns:');
        tableCheck.rows.forEach(col => {
          console.log(`      ${col.column_name}: ${col.data_type}`);
        });
      } else {
        console.log('   ❌ Documents table does not exist');
      }
      
      await pool.end();
    } catch (error) {
      console.log('   ❌ Database connection failed:', error.message);
    }

    // Test 4: Check if your updated routes file is actually being used
    console.log('\n📁 Test 4: Route File Check');
    try {
      const fs = require('fs');
      const routeContent = fs.readFileSync('./routes/documents.js', 'utf8');
      
      // Look for the fix we applied
      const hasValidationFix = routeContent.includes('Valid affidavit data is required');
      const hasOldBuggyCode = routeContent.includes('affidavitData.affiantName || \'Draft\'');
      
      console.log('   Fixed validation present:', hasValidationFix ? '✅' : '❌');
      console.log('   Old buggy code present:', hasOldBuggyCode ? '❌ Still there' : '✅ Removed');
      
      if (!hasValidationFix) {
        console.log('   ⚠️  The fix wasn\'t applied to your routes file');
      }
      
    } catch (error) {
      console.log('   ❌ Could not read routes file:', error.message);
    }

    // Test 5: Check server.js for route mounting
    console.log('\n🖥️  Test 5: Server Route Mounting');
    try {
      const fs = require('fs');
      const serverContent = fs.readFileSync('./server.js', 'utf8');
      
      const hasDocumentsRoute = serverContent.includes('/api/documents') || 
                               serverContent.includes('documentsRouter') ||
                               serverContent.includes('./routes/documents');
      
      console.log('   Documents route mounted:', hasDocumentsRoute ? '✅' : '❌');
      
      if (!hasDocumentsRoute) {
        console.log('   ⚠️  Documents route might not be mounted in server.js');
      }
      
    } catch (error) {
      console.log('   ❌ Could not read server.js:', error.message);
    }

    // Test 6: Frontend save call simulation
    console.log('\n🌐 Test 6: Frontend Save Call Simulation');
    
    // This simulates what your frontend should be doing
    console.log('   Simulating frontend DocumentContext.saveDocument call...');
    console.log('   Expected payload structure:');
    console.log('   {');
    console.log('     affidavitData: {');
    console.log('       affiantName: "Mike Jones",');
    console.log('       state: "AZ",');
    console.log('       facts: [...] // 8 facts');
    console.log('     }');
    console.log('   }');

    // Test 7: Check for frontend-backend data mismatch
    console.log('\n🔄 Test 7: Data Structure Analysis');
    
    // From your logs, the chat response shows this structure:
    const chatResponseData = {
      state: 'AZ',
      affiantName: 'Mike Jones',
      facts: [] // 8 objects
    };
    
    console.log('   Chat processing outputs:');
    console.log('   - affiantName: "Mike Jones" ✅');
    console.log('   - state: "AZ" ✅');
    console.log('   - facts: Array(8) ✅');
    
    console.log('\n   Questions to check in your frontend:');
    console.log('   1. Is DocumentContext.saveDocument being called?');
    console.log('   2. What data is being sent to /api/documents/save?');
    console.log('   3. Are you getting any 400/500 errors in browser dev tools?');
    console.log('   4. Check Network tab when you try to save');

  } catch (error) {
    console.error('💥 Debug script failed:', error.message);
  }

  // Instructions
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DEBUGGING STEPS FOR YOU:');
  console.log('='.repeat(60));
  
  console.log('\n1. CHECK BROWSER DEV TOOLS:');
  console.log('   - Open Network tab');
  console.log('   - Try to save an affidavit');
  console.log('   - Look for calls to /api/documents/save');
  console.log('   - Check if any requests are failing');
  
  console.log('\n2. CHECK SERVER LOGS:');
  console.log('   - Look for "Save document failed" messages');
  console.log('   - Look for calls to /api/documents/save in logs');
  console.log('   - Check if save route is being hit at all');
  
  console.log('\n3. MANUAL DATABASE CHECK:');
  console.log('   - Run: SELECT * FROM documents WHERE user_id = 4;');
  console.log('   - See if any documents exist');
  console.log('   - Check the content column structure');
  
  console.log('\n4. RESTART SERVER:');
  console.log('   - Make sure the fixed routes/documents.js is loaded');
  console.log('   - pm2 restart affidavit-app');
  
  console.log('\n5. FRONTEND SAVE TRIGGER:');
  console.log('   - Check if save is triggered automatically');
  console.log('   - Or if user needs to click a "Save" button');
  console.log('   - Verify DocumentContext.saveDocument is called');
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

debugSaveIssues().catch(console.error);