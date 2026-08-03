drop function if exists public.review_catch(uuid, text);
drop function if exists public.moderator_update_catch(uuid, jsonb);
drop function if exists public.moderator_delete_catch(uuid);

create or replace function public.review_catch(catch_id bigint, decision text)
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

revoke all on function public.review_catch(bigint, text) from public;
grant execute on function public.review_catch(bigint, text) to authenticated;

create or replace function public.moderator_update_catch(catch_id bigint, changes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_catch public.catches%rowtype;
  updated_catch public.catches%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  select * into current_catch
  from public.catches
  where id = catch_id;

  if not found then
    raise exception 'Catch not found';
  end if;

  updated_catch := jsonb_populate_record(current_catch, changes);

  update public.catches
  set species = updated_catch.species,
      location = updated_catch.location,
      length = updated_catch.length,
      fly = updated_catch.fly,
      date = updated_catch.date,
      time = updated_catch.time,
      notes = updated_catch.notes,
      is_public = updated_catch.is_public
  where id = catch_id;
end;
$$;

revoke all on function public.moderator_update_catch(bigint, jsonb) from public;
grant execute on function public.moderator_update_catch(bigint, jsonb) to authenticated;

create or replace function public.moderator_delete_catch(catch_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderator access required';
  end if;

  delete from public.catches
  where id = catch_id;

  if not found then
    raise exception 'Catch not found';
  end if;
end;
$$;

revoke all on function public.moderator_delete_catch(bigint) from public;
grant execute on function public.moderator_delete_catch(bigint) to authenticated;

