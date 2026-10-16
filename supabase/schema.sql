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

-- Forgetting runs as ONE transaction: every step happens or none does, and retrying is harmless.
-- SECURITY INVOKER means it runs as the signed-in user, so Row Level Security still applies.
create or replace function forget_memory(p_memory uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare v_chain text;
begin
  if exists (select 1 from tombstones where memory_id = p_memory) then
    return;  -- already forgotten
  end if;
  select chain_hash into v_chain from versions where memory_id = p_memory order by version_no desc limit 1;
  if v_chain is null then
    raise exception 'This memory does not exist in your archive.' using errcode = 'P0002';
  end if;
  delete from claims where memory_id = p_memory;
  delete from tags where memory_id = p_memory;
  delete from memory_keys where memory_id = p_memory;  -- crypto-shredding: the text can never be decrypted again
  update versions set content_hash = null where memory_id = p_memory;
  update memories set title = null, summary = null, cover = null, favourite = false, forgotten_at = now(), updated_at = now()
    where id = p_memory;
  insert into tombstones (memory_id, chain_hash) values (p_memory, v_chain);
end $$;
revoke all on function forget_memory(uuid) from public, anon;
grant execute on function forget_memory(uuid) to authenticated;

-- Saving a memory, a retelling, or a memory's tags is ONE transaction each: nothing is ever half-saved.
-- SECURITY INVOKER: they run as the signed-in user, so Row Level Security still applies.
create or replace function create_memory(
  p_title text, p_summary text, p_summary_generated boolean, p_category text, p_memory_date date,
  p_cover text, p_style text, p_key text, p_told_on date, p_ciphertext text, p_iv text,
  p_content_hash text, p_chain_hash text, p_sealed_at text, p_claims jsonb, p_tags text[]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_mem uuid; v_ver uuid;
begin
  insert into memories (title, summary, summary_generated, category, memory_date, cover, style)
    values (p_title, p_summary, p_summary_generated, p_category, p_memory_date, p_cover, p_style) returning id into v_mem;
  insert into memory_keys (memory_id, key_b64) values (v_mem, p_key);
  insert into versions (memory_id, version_no, told_on, ciphertext, iv, content_hash, prev_hash, chain_hash, sealed_at)
    values (v_mem, 1, p_told_on, p_ciphertext, p_iv, p_content_hash, 'genesis', p_chain_hash, p_sealed_at) returning id into v_ver;
  insert into claims (memory_id, version_id, idx, text, quote, start_char, end_char)
    select v_mem, v_ver, (c->>'idx')::int, c->>'text', c->>'quote', (c->>'start_char')::int, (c->>'end_char')::int
    from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) c;
  insert into tags (memory_id, tag) select distinct v_mem, t from unnest(coalesce(p_tags, '{}'::text[])) t;
  return v_mem;
end $$;

create or replace function retell_memory(
  p_memory uuid, p_told_on date, p_ciphertext text, p_iv text, p_content_hash text,
  p_prev_hash text, p_chain_hash text, p_sealed_at text, p_claims jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare v_no int; v_chain text; v_ver uuid;
begin
  if not exists (select 1 from memory_keys where memory_id = p_memory) then
    raise exception 'This memory has been forgotten and cannot be retold.';
  end if;
  -- lock the latest telling so two retellings at once can't both claim the next number
  select version_no, chain_hash into v_no, v_chain from versions where memory_id = p_memory
    order by version_no desc limit 1 for update;
  if v_chain is distinct from p_prev_hash then
    -- plain error code on purpose: 40001 (serialization failure) can make callers retry automatically
    raise exception 'This memory changed while you were retelling it. Please try again.';
  end if;
  insert into versions (memory_id, version_no, told_on, ciphertext, iv, content_hash, prev_hash, chain_hash, sealed_at)
    values (p_memory, v_no + 1, p_told_on, p_ciphertext, p_iv, p_content_hash, p_prev_hash, p_chain_hash, p_sealed_at)
    returning id into v_ver;
  insert into claims (memory_id, version_id, idx, text, quote, start_char, end_char)
    select p_memory, v_ver, (c->>'idx')::int, c->>'text', c->>'quote', (c->>'start_char')::int, (c->>'end_char')::int
    from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) c;
  update memories set updated_at = now() where id = p_memory;
end $$;

create or replace function set_memory_tags(p_memory uuid, p_tags text[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from memories where id = p_memory and forgotten_at is null) then
    raise exception 'This memory has been forgotten or does not exist.' using errcode = 'P0002';
  end if;
  delete from tags where memory_id = p_memory;
  insert into tags (memory_id, tag) select distinct p_memory, t from unnest(coalesce(p_tags, '{}'::text[])) t;
end $$;

revoke all on function create_memory(text, text, boolean, text, date, text, text, text, date, text, text, text, text, text, jsonb, text[]) from public, anon;
revoke all on function retell_memory(uuid, date, text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function set_memory_tags(uuid, text[]) from public, anon;
grant execute on function create_memory(text, text, boolean, text, date, text, text, text, date, text, text, text, text, text, jsonb, text[]) to authenticated;
grant execute on function retell_memory(uuid, date, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function set_memory_tags(uuid, text[]) to authenticated;
