-- database_schema_fix.sql
-- Add missing columns for validation and consolidation

-- Add validation_result column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

-- Add category tracking for facts
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS fact_categories JSONB;

-- Add processing metadata
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS processing_metadata JSONB;

-- Update documents table with helpful indexes
CREATE INDEX IF NOT EXISTS idx_documents_validation ON documents USING GIN (validation_result);
CREATE INDEX IF NOT EXISTS idx_documents_categories ON documents USING GIN (fact_categories);

-- Add comment for documentation
COMMENT ON COLUMN documents.validation_result IS 'Stores LLM validation results and quality scores';
COMMENT ON COLUMN documents.fact_categories IS 'Categorized facts by legal type (financial, property, etc.)';
COMMENT ON COLUMN documents.processing_metadata IS 'Processing stats, LLM calls, performance metrics';

-- Sample data structure for validation_result:
/*
{
  "overall_quality_score": 8.5,
  "total_facts": 12,
  "facts_by_category": {
    "parental": 5,
    "financial": 3,
    "witness": 4
  },
  "critical_issues": 0,
  "warnings": 2,
  "last_validated": "2025-09-02T21:25:00.000Z",
  "validation_method": "consolidated_llm"
}
*/

-- Sample data structure for fact_categories:
/*
{
  "financial": [
    {
      "id": "fact_123",
      "confidence": 0.95,
      "subcategory": "support",
      "legal_weight": "high"
    }
  ],
  "parental": [
    {
      "id": "fact_124", 
      "confidence": 0.88,
      "subcategory": "childcare",
      "legal_weight": "medium"
    }
  ]
}
*/

-- Run this to fix your current database:
-- psql -d your_database_name -f database_schema_fix.sql