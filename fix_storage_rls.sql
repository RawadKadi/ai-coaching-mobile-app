-- 1. Enable public read access for the chat-media bucket
-- This ensures that if a user sends an image, the recipient can actually see it.
DROP POLICY IF EXISTS "Give public read access to chat-media" ON storage.objects;
CREATE POLICY "Give public read access to chat-media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-media');

-- 2. Allow authenticated users to upload to the chat-media bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to chat-media" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to chat-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- 3. (Optional but recommended) Allow users to delete their own uploads
DROP POLICY IF EXISTS "Allow users to delete their own chat-media" ON storage.objects;
CREATE POLICY "Allow users to delete their own chat-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
