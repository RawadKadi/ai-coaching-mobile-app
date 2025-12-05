-- Create the storage bucket for meal photos if it doesn't exist
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', true)
on conflict (id) do nothing;

-- Drop existing policies to ensure clean slate and avoid duplicates
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Users can update their own images" on storage.objects;
drop policy if exists "Users can delete their own images" on storage.objects;

-- Set up RLS policies for the bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'meal-photos' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'meal-photos' and auth.role() = 'authenticated' );

create policy "Users can update their own images"
  on storage.objects for update
  using ( bucket_id = 'meal-photos' and auth.uid() = owner )
  with check ( bucket_id = 'meal-photos' and auth.uid() = owner );

create policy "Users can delete their own images"
  on storage.objects for delete
  using ( bucket_id = 'meal-photos' and auth.uid() = owner );
