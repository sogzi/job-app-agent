-- Run this in the Supabase SQL editor to create the applications table.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role_title text not null,
  company text not null default '',
  job_url text,
  job_description text not null,
  relevance_score integer not null,
  analysis jsonb not null,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
  applied_on date,
  follow_up_on date,
  notes text not null default ''
);

-- The app talks to Supabase only from the server with the service role key.
-- Row level security stays on with no policies, so the anon key cannot read this table.
alter table public.applications enable row level security;
