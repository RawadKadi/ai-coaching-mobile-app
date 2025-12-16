-- Add metadata column to messages table to support structured actions (e.g., reschedule proposals)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN messages.metadata IS 'Stores structured data for interactive messages, such as reschedule proposals, action buttons, etc.';
