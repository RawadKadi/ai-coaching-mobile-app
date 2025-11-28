-- Add image_url to habit_logs
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for habit verifications if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('habit-verifications', 'habit-verifications', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload habit verifications"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'habit-verifications');

-- Allow authenticated users to view
CREATE POLICY "Authenticated users can view habit verifications"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'habit-verifications');
