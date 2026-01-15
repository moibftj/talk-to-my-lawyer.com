-- Add Workflow DevKit tracking columns to letters table
-- Migration: 20260115000001_add_workflow_tracking.sql
-- Purpose: Enable tracking of Workflow DevKit execution state for letter generation

BEGIN;

-- Add workflow tracking columns to letters table
ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS workflow_id TEXT,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS workflow_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_error TEXT;

-- Create index for efficient workflow lookups
CREATE INDEX IF NOT EXISTS idx_letters_workflow_id ON letters(workflow_id);

-- Create index for workflow status queries
CREATE INDEX IF NOT EXISTS idx_letters_workflow_status ON letters(workflow_status) WHERE workflow_status IS NOT NULL;

-- Add helpful comments for documentation
COMMENT ON COLUMN letters.workflow_id IS 'Workflow DevKit execution ID for tracking durable workflow state';
COMMENT ON COLUMN letters.workflow_status IS 'Current workflow execution status: running, completed, failed, paused';
COMMENT ON COLUMN letters.workflow_started_at IS 'Timestamp when the workflow execution started';
COMMENT ON COLUMN letters.workflow_completed_at IS 'Timestamp when the workflow execution completed (success or failure)';
COMMENT ON COLUMN letters.workflow_error IS 'Error message if workflow execution failed';

-- Add constraint to ensure workflow_status is one of the valid values (optional but recommended)
ALTER TABLE letters
  ADD CONSTRAINT check_workflow_status
  CHECK (workflow_status IS NULL OR workflow_status IN ('running', 'completed', 'failed', 'paused'));

-- Grant necessary permissions to authenticated users (via RLS policies)
-- No explicit grants needed - RLS policies on letters table already control access

COMMIT;
