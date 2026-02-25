-- Run this in your Supabase SQL Editor to set up the database

-- Enable storage for receipt images
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Allow public uploads to receipts bucket (no auth needed to upload)
create policy "Allow public uploads"
on storage.objects for insert
to anon
with check (bucket_id = 'receipts');

-- Allow authenticated reads from receipts bucket
create policy "Allow authenticated reads"
on storage.objects for select
to authenticated
using (bucket_id = 'receipts');

-- Receipts table
create table if not exists receipts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,

  -- Image
  image_url text not null,
  image_path text not null,

  -- Extracted fields
  vendor text,
  receipt_date date,
  total numeric(10, 2),
  tax numeric(10, 2),
  subtotal numeric(10, 2),
  payment_method text,
  category text,
  description text,

  -- Raw Claude response for debugging
  raw_extraction jsonb,

  -- Processing status
  status text default 'processing' check (status in ('processing', 'completed', 'failed', 'needs_review')),

  -- User can override/edit
  reviewed boolean default false,
  notes text
);

-- RLS: Anyone can insert (public upload)
alter table receipts enable row level security;

create policy "Allow public inserts"
on receipts for insert
to anon
with check (true);

-- RLS: Only authenticated users can read
create policy "Allow authenticated reads"
on receipts for select
to authenticated
using (true);

-- RLS: Only authenticated users can update
create policy "Allow authenticated updates"
on receipts for update
to authenticated
using (true);

-- RLS: Only authenticated users can delete
create policy "Allow authenticated deletes"
on receipts for delete
to authenticated
using (true);

-- Allow authenticated deletes from storage
create policy "Allow authenticated storage deletes"
on storage.objects for delete
to authenticated
using (bucket_id = 'receipts');

-- Index for dashboard queries
create index idx_receipts_date on receipts (receipt_date desc);
create index idx_receipts_category on receipts (category);
create index idx_receipts_status on receipts (status);
