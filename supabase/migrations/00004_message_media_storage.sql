-- Create storage bucket for message media (images, audio)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-media', 'message-media', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-media');

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access for message media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-media');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-media' AND auth.uid()::text = owner_id::text);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-media' AND auth.uid()::text = owner_id::text);
