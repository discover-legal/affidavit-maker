#! scripts/cleanPdfs.js
const { enhancedPdfService } = require('../services/enhancedPdfService');

async function cleanOldPdfs() {
  try {
    const result = await enhancedPdfService.cleanupOldPDFs(48); // 48 hours
    console.log(result.message);
  } catch (error) {
    console.error('PDF cleanup failed:', error);
  }
}

cleanOldPdfs();