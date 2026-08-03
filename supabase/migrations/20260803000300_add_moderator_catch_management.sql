create or replace function public.moderator_update_catch(catch_id uuid, changes jsonb)
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

revoke all on function public.moderator_update_catch(uuid, jsonb) from public;
grant execute on function public.moderator_update_catch(uuid, jsonb) to authenticated;

create or replace function public.moderator_delete_catch(catch_id uuid)
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

revoke all on function public.moderator_delete_catch(uuid) from public;
grant execute on function public.moderator_delete_catch(uuid) to authenticated;

