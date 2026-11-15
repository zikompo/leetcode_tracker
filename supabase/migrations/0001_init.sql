-- LeetTrack schema (spec 9.2, simplified for M4).
--
-- Each table stores one app record as `data` (the validated Problem, Attempt, Settings or
-- CustomList object from @leettrack/core), plus the columns needed to query and sync it.
-- Cards are never stored: they are recomputed from attempts (spec 9.3).
--
--   updated_at         the client's last-write-wins time (from data.updatedAt)
--   server_updated_at  set by the server on every write; clients pull rows newer than this

create table public.attempts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  problem_slug text not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  data jsonb not null,
  primary key (user_id, id)
);
create index attempts_pull on public.attempts (user_id, server_updated_at);
create index attempts_problem on public.attempts (user_id, problem_slug);

create table public.user_problems (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  data jsonb not null,
  primary key (user_id, slug)
);
create index user_problems_pull on public.user_problems (user_id, server_updated_at);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  data jsonb not null
);

create table public.custom_lists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  -- Deleted lists stay as tombstones so the delete reaches every device.
  deleted boolean not null default false,
  data jsonb not null,
  primary key (user_id, id)
);
create index custom_lists_pull on public.custom_lists (user_id, server_updated_at);

-- The server clock decides what counts as "new since last pull", never a device clock.
create function public.touch_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end
$$;

revoke all on function public.touch_server_updated_at() from public, anon, authenticated;

create trigger attempts_touch before insert or update on public.attempts
  for each row execute function public.touch_server_updated_at();
create trigger user_problems_touch before insert or update on public.user_problems
  for each row execute function public.touch_server_updated_at();
create trigger settings_touch before insert or update on public.settings
  for each row execute function public.touch_server_updated_at();
create trigger custom_lists_touch before insert or update on public.custom_lists
  for each row execute function public.touch_server_updated_at();

-- Row-level security: people only ever see and change their own rows.
alter table public.attempts enable row level security;
alter table public.user_problems enable row level security;
alter table public.settings enable row level security;
alter table public.custom_lists enable row level security;

create policy "own attempts" on public.attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own problems" on public.user_problems for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own lists" on public.custom_lists for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.attempts, public.user_problems, public.settings, public.custom_lists
  to authenticated;

-- Push a batch of changed records. Each row is written only if it is newer than what the
-- server has (last write wins, spec 9.3), so pushes can be retried and arrive in any order.
-- Runs as the caller, so row-level security still applies.
create function public.sync_push(
  p_attempts jsonb default '[]'::jsonb,
  p_problems jsonb default '[]'::jsonb,
  p_settings jsonb default null,
  p_lists jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n_attempts int;
  n_problems int;
  n_settings int := 0;
  n_lists int;
begin
  if uid is null then
    raise exception 'Sign in to sync' using errcode = '28000';
  end if;

  insert into public.attempts as t (user_id, id, problem_slug, updated_at, data)
  select uid, x ->> 'id', x ->> 'problemSlug', (x ->> 'updatedAt')::timestamptz, x
  from jsonb_array_elements(p_attempts) as x
  on conflict (user_id, id) do update
    set problem_slug = excluded.problem_slug, updated_at = excluded.updated_at, data = excluded.data
    where t.updated_at < excluded.updated_at;
  get diagnostics n_attempts = row_count;

  insert into public.user_problems as t (user_id, slug, updated_at, data)
  select uid, x ->> 'slug', (x ->> 'updatedAt')::timestamptz, x
  from jsonb_array_elements(p_problems) as x
  on conflict (user_id, slug) do update
    set updated_at = excluded.updated_at, data = excluded.data
    where t.updated_at < excluded.updated_at;
  get diagnostics n_problems = row_count;

  if p_settings is not null then
    insert into public.settings as t (user_id, updated_at, data)
    values (uid, (p_settings ->> 'updatedAt')::timestamptz, p_settings)
    on conflict (user_id) do update
      set updated_at = excluded.updated_at, data = excluded.data
      where t.updated_at < excluded.updated_at;
    get diagnostics n_settings = row_count;
  end if;

  insert into public.custom_lists as t (user_id, id, updated_at, deleted, data)
  select uid, x ->> 'id', (x ->> 'updatedAt')::timestamptz,
         coalesce((x ->> 'deleted')::boolean, false), x
  from jsonb_array_elements(p_lists) as x
  on conflict (user_id, id) do update
    set updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data
    where t.updated_at < excluded.updated_at;
  get diagnostics n_lists = row_count;

  return jsonb_build_object(
    'attempts', n_attempts, 'problems', n_problems, 'settings', n_settings, 'lists', n_lists
  );
end
$$;

-- Supabase grants new functions to anon by default; only signed-in users may call these.
revoke all on function public.sync_push(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_push(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Delete the caller's account and, through the foreign keys, all of their data.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
