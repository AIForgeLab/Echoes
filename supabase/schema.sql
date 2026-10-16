-- Echoes database schema.
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run. Safe to re-run.

create extension if not exists pgcrypto;

-- One row per memory.
create table if not exists memories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  title             text,                       -- wiped on forget
  summary           text,                       -- AI or user summary, kept apart from the original; wiped on forget
  summary_generated boolean not null default false,
  category          text not null default 'Personal',
  memory_date       date,
  cover             text,                       -- small image as a data URL, optional; wiped on forget
  style             text not null default 'Cinematic',
  favourite         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  forgotten_at      timestamptz
);

-- Every telling of a memory. The text is stored ONLY as AES-GCM ciphertext.
create table if not exists versions (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references memories on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  version_no   int  not null,
  told_on      date,
  ciphertext   text not null,
  iv           text not null,
  content_hash text,            -- SHA-256 of the canonical plaintext; nulled on forget
  prev_hash    text not null,   -- chain_hash of the previous telling, or 'genesis'
  chain_hash   text not null,   -- SHA-256(prev_hash | content_hash | sealed_at)
  sealed_at    text not null,
  unique (memory_id, version_no)
);

-- Atomic claims with exact character spans (derived data).
create table if not exists claims (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references versions on delete cascade,
  memory_id   uuid not null references memories on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  idx         int  not null,
  text        text not null,
  quote       text not null,
  start_char  int  not null,
  end_char    int  not null
);

create table if not exists tags (
  memory_id uuid not null references memories on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  tag       text not null,
  primary key (memory_id, tag)
);

-- Per-memory keys, kept apart from the ciphertext. Deleting the row = crypto-shredding of the live data.
-- Note: database backups taken before a forget still contain the key, so they stay readable until they expire.
create table if not exists memory_keys (
  memory_id uuid primary key references memories on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  key_b64   text not null
);

-- What remains after forgetting: proof something was here, not what it was.
create table if not exists tombstones (
  memory_id    uuid primary key references memories on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  chain_hash   text not null,
  forgotten_at timestamptz not null default now()
);

-- Upgrades for databases created from the first version of this file
alter table memories add column if not exists summary text;
alter table memories add column if not exists summary_generated boolean not null default false;
alter table memories add column if not exists category text not null default 'Personal';
alter table memories add column if not exists memory_date date;
alter table memories add column if not exists cover text;
alter table memories add column if not exists style text not null default 'Cinematic';
alter table memories add column if not exists favourite boolean not null default false;
alter table memories add column if not exists updated_at timestamptz not null default now();

-- Row Level Security: every user can see and change only their own rows.
do $$
declare t text;
begin
  foreach t in array array['memories','versions','claims','tags','memory_keys','tombstones'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
