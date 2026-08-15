-- MANUAL ROLLBACK ONLY. Never place this file in supabase/migrations.
-- Running it permanently deletes community fly-pattern records and leaves any
-- uploaded Storage objects to be removed through the Supabase Storage API.

drop policy if exists "community fly images deletable by editors" on storage.objects;
drop policy if exists "community fly images updateable by editors" on storage.objects;
drop policy if exists "community fly images insertable by editors" on storage.objects;
drop policy if exists "community fly images readable with pattern" on storage.objects;

delete from storage.buckets where id = 'community-fly-pattern-images';

drop function if exists public.community_fly_pattern_id_from_storage_name(text);
drop function if exists public.moderator_delete_community_fly_pattern(uuid, text);
drop function if exists public.moderator_update_community_fly_pattern(uuid, jsonb);
drop function if exists public.moderate_community_fly_pattern(uuid, text, text);
drop function if exists public.submit_community_fly_pattern(uuid);

drop table if exists public.community_fly_pattern_moderation_log;
drop table if exists public.community_fly_pattern_steps;
drop table if exists public.community_fly_pattern_materials;
drop table if exists public.community_fly_patterns;

drop function if exists public.audit_community_fly_pattern_delete();
drop function if exists public.validate_community_fly_step_image_path();
drop function if exists public.protect_community_fly_pattern_write();
drop function if exists public.touch_community_fly_parent();
drop function if exists public.touch_community_fly_updated_at();
drop function if exists public.can_edit_community_fly_pattern(uuid, uuid);
drop function if exists public.can_read_community_fly_pattern(uuid, uuid);

-- pgcrypto is intentionally retained because other application objects may use it.