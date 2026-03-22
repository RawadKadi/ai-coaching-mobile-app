DO $$
BEGIN
  -- 1. Create the 'chat-media' bucket
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('chat-media', 'chat-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  -- 2. Create RLS Policies for the storage objects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to insert chat media' AND schemaname = 'storage') THEN
      CREATE POLICY "Allow authenticated users to insert chat media"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK ( bucket_id = 'chat-media' );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated users to select chat media' AND schemaname = 'storage') THEN
      CREATE POLICY "Allow authenticated users to select chat media"
      ON storage.objects FOR SELECT TO authenticated
      USING ( bucket_id = 'chat-media' );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow owners to delete their chat media' AND schemaname = 'storage') THEN
      CREATE POLICY "Allow owners to delete their chat media"
      ON storage.objects FOR DELETE TO authenticated
      USING ( bucket_id = 'chat-media' AND auth.uid() = owner );
  END IF;
END $$;
