// scripts/cleanLogs.js
const fs = require('fs').promises;
const path = require('path');

async function cleanLogs() {
  const logsDir = path.join(__dirname, '..', 'logs');
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  try {
    const files = await fs.readdir(logsDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        console.log(`Deleted old log file: ${file}`);
      }
    }
    
    console.log('Log cleanup complete');
  } catch (error) {
    console.error('Error cleaning logs:', error);
  }
}

cleanLogs();