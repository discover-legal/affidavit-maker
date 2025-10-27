-- Migration: Add preview_data and last_preview_generated columns for preview caching
-- This fixes the "column preview_data does not exist" and "column last_preview_generated does not exist" errors

-- Add preview_data column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS preview_data JSONB DEFAULT NULL;

-- Add last_preview_generated timestamp column
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS last_preview_generated TIMESTAMP DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_preview_data 
ON documents USING gin(preview_data);

-- Add index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_documents_last_preview_generated 
ON documents(last_preview_generated);

-- Add comments
COMMENT ON COLUMN documents.preview_data IS 'Cached preview data for faster rendering';
COMMENT ON COLUMN documents.last_preview_generated IS 'Timestamp of when preview was last generated';

-- Success message
SELECT 'Preview caching columns added successfully!' as message;