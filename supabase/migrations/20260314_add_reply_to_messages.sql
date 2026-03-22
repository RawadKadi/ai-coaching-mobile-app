-- Add reply_to_id column to messages table
ALTER TABLE messages 
ADD COLUMN reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- Index for better lookup performance
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
