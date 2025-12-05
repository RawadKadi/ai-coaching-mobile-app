-- Add message_type column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';

-- Add check constraint for message types
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages 
ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'video', 'file', 'call_invite', 'system'));
