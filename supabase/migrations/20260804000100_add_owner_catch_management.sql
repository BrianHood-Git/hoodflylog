drop policy if exists "Users can update own catches" on public.catches;
create policy "Users can update own catches"
on public.catches
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own catches" on public.catches;
create policy "Users can delete own catches"
on public.catches
for delete
to authenticated
using (user_id = auth.uid());
