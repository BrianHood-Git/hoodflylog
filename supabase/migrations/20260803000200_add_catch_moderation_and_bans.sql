alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references auth.users(id),
  add column if not exists ban_reason text;
insert into public.profiles (id, email)
select id, email
from auth.users
where email is not null
on conflict (id) do update set email = excluded.email;

update public.profiles
set role = 'moderator'
where lower(email) = 'nasskater89@gmail.com';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'nasskater89@gmail.com' then 'moderator' else 'angler' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists create_profile_for_auth_user on auth.users;
create trigger create_profile_for_auth_user
after insert on auth.users
for each row execute function public.handle_new_auth_user();



alter table public.catches
  add column if not exists moderation_status text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id);

update public.catches
set moderation_status = 'approved'
where moderation_status is null;

alter table public.catches
  alter column moderation_status set default 'pending',
  alter column moderation_status set not null;

alter table public.catches
  drop constraint if exists catches_moderation_status_check;

alter table public.catches
  add constraint catches_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected'));

create or replace function public.is_banned(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select is_banned from public.profiles where id = check_user_id
  ), false);
$$;

revoke all on function public.is_banned(uuid) from public;
grant execute on function public.is_banned(uuid) to authenticated;

create or replace function public.enforce_catch_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_banned(new.user_id) and auth.uid() = new.user_id then
    raise exception 'This account is banned';
  end if;

  if not public.is_moderator() and auth.uid() = new.user_id then
    if tg_op = 'INSERT' then
      new.moderation_status := 'pending';
      new.moderated_at := null;
      new.moderated_by := null;
    else
      new.moderation_status := old.moderation_status;
      new.moderated_at := old.moderated_at;
      new.moderated_by := old.moderated_by;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_catch_submission_trigger on public.catches;
create trigger enforce_catch_submission_trigger
before insert or update on public.catches
for each row execute function public.enforce_catch_submission();

drop policy if exists "Approved catches or authorized users can view" on public.catches;
create policy "Approved catches or authorized users can view"
on public.catches
as restrictive
for select
to anon, authenticated
using (
  (is_public = true and moderation_status = 'approved')
  or user_id = auth.uid()
  or public.is_moderator()
);

drop policy if exists "Moderators can view all catches" on public.catches;
create policy "Moderators can view all catches"
on public.catches
for select
to authenticated
using (public.is_moderator());

create or replace function public.review_catch(catch_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.catches
  set moderation_status = decision,
      moderated_at = now(),
      moderated_by = auth.uid()
  where id = catch_id;

  if not found then
    raise exception 'Catch not found';
  end if;
end;
$$;

revoke all on function public.review_catch(uuid, text) from public;
grant execute on function public.review_catch(uuid, text) to authenticated;

create or replace function public.set_user_ban(target_email text, should_ban boolean, reason text default null)
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

  if normalized_email = 'nasskater89@gmail.com' then
    raise exception 'The owner account cannot be banned';
  end if;

  if target_profile.id = auth.uid() then
    raise exception 'A moderator cannot ban their own account';
  end if;

  if should_ban and nullif(trim(reason), '') is null then
    raise exception 'A ban reason is required';
  end if;

  update public.profiles
  set is_banned = should_ban,
      banned_at = case when should_ban then now() else null end,
      banned_by = case when should_ban then auth.uid() else null end,
      ban_reason = case when should_ban then trim(reason) else null end,
      role = case when should_ban then 'angler' else role end,
      updated_at = now()
  where id = target_profile.id;

  if should_ban then
    update public.catches
    set moderation_status = 'rejected',
        moderated_at = now(),
        moderated_by = auth.uid()
    where user_id = target_profile.id
      and moderation_status in ('pending', 'approved');
  end if;
end;
$$;

revoke all on function public.set_user_ban(text, boolean, text) from public;
grant execute on function public.set_user_ban(text, boolean, text) to authenticated;

