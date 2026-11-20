-- Moderatör rolü: yalnızca sahne sorularını görür ve yönetir (seç, birleştir, düzenle, "soruldu").
-- Başvurulara, e-postalara, check-in'e, quize ve ayarlara erişemez.
-- Soru alımını açma/kapama ve tüm soruları silme yalnızca admin'de kalır.
-- Not: yeni enum değeri aynı işlemde kullanılamayacağı için karşılaştırmalar role::text ile yapılır.

alter type public.staff_role add value if not exists 'moderator';

-- Check-in yalnızca admin ve kapı ekibi (moderatör hariç).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid() and role::text in ('admin', 'checkin'));
$$;

create or replace function public.is_stage_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid() and role::text in ('admin', 'moderator'));
$$;

create or replace function public._require_stage_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_stage_staff() then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.is_stage_staff() from public, anon;
revoke execute on function public._require_stage_staff() from public, anon, authenticated;
grant execute on function public.is_stage_staff() to authenticated, service_role;

drop policy if exists stage_settings_admin_read on public.stage_settings;
drop policy if exists stage_questions_admin_read on public.stage_questions;
create policy stage_settings_stage_read on public.stage_settings for select to authenticated
  using ((select public.is_stage_staff()));
create policy stage_questions_stage_read on public.stage_questions for select to authenticated
  using ((select public.is_stage_staff()));

create or replace function public.admin_stage_set_status(p_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_stage_staff();
  v_count integer;
begin
  if p_status is null or p_status not in ('new', 'selected', 'asked', 'archived')
     or p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  update public.stage_questions
     set status = p_status, merged_into = null, status_changed_at = now()
   where id = any (p_ids) and status is distinct from p_status;
  get diagnostics v_count = row_count;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'stage_set_status', jsonb_build_object('status', p_status, 'count', v_count));
  return v_count;
end;
$$;

create or replace function public.admin_stage_merge(p_target uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_stage_staff();
  v_ids uuid[];
  v_count integer;
begin
  if p_target is null or p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  perform 1 from public.stage_questions where id = p_target and status <> 'merged' for update;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;
  v_ids := array(select distinct x from unnest(p_ids) x where x <> p_target);
  if cardinality(v_ids) = 0 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;

  update public.stage_questions
     set merged_into = p_target, status_changed_at = now()
   where merged_into = any (v_ids);
  update public.stage_questions
     set status = 'merged', merged_into = p_target, status_changed_at = now()
   where id = any (v_ids);
  get diagnostics v_count = row_count;

  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'stage_merge', jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create or replace function public.admin_stage_update_body(p_id uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_stage_staff();
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 3 or char_length(v_body) > 600 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  update public.stage_questions set body = v_body where id = p_id;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'stage_edit', '{}'::jsonb);
  return true;
end;
$$;

