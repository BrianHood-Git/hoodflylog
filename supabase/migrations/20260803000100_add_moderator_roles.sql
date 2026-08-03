alter table public.profiles
  add column if not exists role text not null default 'angler';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('angler', 'moderator'));

update public.profiles
set role = 'moderator'
where lower(email) = 'nasskater89@gmail.com';

create or replace function public.is_moderator(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and (role = 'moderator' or lower(email) = 'nasskater89@gmail.com')
  );
$$;

revoke all on function public.is_moderator(uuid) from public;
grant execute on function public.is_moderator(uuid) to authenticated;

drop policy if exists "Moderators can view profiles" on public.profiles;
create policy "Moderators can view profiles"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_moderator());

create or replace function public.set_moderator_role(target_email text, make_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_profile public.profiles%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  select * into target_profile
  from public.profiles
  where lower(email) = normalized_email;

  if not found then
    raise exception 'No profile found for that email';
  end if;

  if normalized_email = 'nasskater89@gmail.com' and not make_moderator then
    raise exception 'The owner moderator cannot be removed';
  end if;

  if target_profile.id = auth.uid() and not make_moderator then
    raise exception 'A moderator cannot remove their own role';
  end if;

  update public.profiles
  set role = case when make_moderator then 'moderator' else 'angler' end,
      updated_at = now()
  where id = target_profile.id;
end;
$$;

revoke all on function public.set_moderator_role(text, boolean) from public;
grant execute on function public.set_moderator_role(text, boolean) to authenticated;

