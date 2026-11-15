-- M7: mock interviews, synced like custom lists (last write wins, deletes are tombstones).

create table public.mock_interviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  data jsonb not null,
  primary key (user_id, id)
);
create index mock_interviews_pull on public.mock_interviews (user_id, server_updated_at);

create trigger mock_interviews_touch before insert or update on public.mock_interviews
  for each row execute function public.touch_server_updated_at();

alter table public.mock_interviews enable row level security;
create policy "own mocks" on public.mock_interviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.mock_interviews to authenticated;

-- sync_push gains p_mocks. It defaults to an empty array, so a caller that doesn't send it
-- (an extension built before M7) still works. The old 4-argument version is replaced, not
-- overloaded, so calls by name stay unambiguous.
drop function public.sync_push(jsonb, jsonb, jsonb, jsonb);

create function public.sync_push(
  p_attempts jsonb default '[]'::jsonb,
  p_problems jsonb default '[]'::jsonb,
  p_settings jsonb default null,
  p_lists jsonb default '[]'::jsonb,
  p_mocks jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n_attempts int;
  n_problems int;
  n_settings int := 0;
  n_lists int;
  n_mocks int;
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

  insert into public.mock_interviews as t (user_id, id, updated_at, deleted, data)
  select uid, x ->> 'id', (x ->> 'updatedAt')::timestamptz,
         coalesce((x ->> 'deleted')::boolean, false), x
  from jsonb_array_elements(p_mocks) as x
  on conflict (user_id, id) do update
    set updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data
    where t.updated_at < excluded.updated_at;
  get diagnostics n_mocks = row_count;

  return jsonb_build_object(
    'attempts', n_attempts, 'problems', n_problems, 'settings', n_settings, 'lists', n_lists,
    'mocks', n_mocks
  );
end
$$;

revoke all on function public.sync_push(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_push(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
