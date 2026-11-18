-- "Sahneye Soru Sor": katılımcılar (ad isteğe bağlı) soru gönderir; ekip seçer,
-- tekrar edenleri birleştirir, moderatör ekranından "soruldu" olarak işaretler.
--  * Sorular yalnızca service role (API rotası, stage_submit) üzerinden yazılır.
--  * Okuma ve tüm değişiklikler admin'in kendi oturumuyla; fonksiyonlar yetkiyi kontrol eder.

create table public.stage_settings (
  id         smallint primary key default 1 check (id = 1),
  is_open    boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.stage_settings (id) values (1) on conflict do nothing;

create table public.stage_questions (
  id                uuid primary key default gen_random_uuid(),
  author_name       text check (author_name is null or char_length(author_name) between 1 and 60),
  body              text not null check (char_length(body) between 3 and 600),
  -- new: gelen · selected: moderatöre iletildi · asked: sahnede soruldu
  -- archived: elendi · merged: başka bir soruyla birleştirildi (merged_into)
  status            text not null default 'new'
                    check (status in ('new', 'selected', 'asked', 'archived', 'merged')),
  merged_into       uuid references public.stage_questions (id),
  created_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  constraint stage_questions_merge_consistent check ((status = 'merged') = (merged_into is not null)),
  constraint stage_questions_not_self check (merged_into is distinct from id)
);
create index stage_questions_status_idx on public.stage_questions (status, created_at);
create index stage_questions_merged_idx on public.stage_questions (merged_into) where merged_into is not null;

alter table public.stage_settings enable row level security;
alter table public.stage_questions enable row level security;
revoke all on public.stage_settings, public.stage_questions from anon, authenticated;
grant select on public.stage_settings, public.stage_questions to authenticated;
grant all on public.stage_settings, public.stage_questions to service_role;

create policy stage_settings_admin_read on public.stage_settings for select to authenticated
  using ((select public.is_admin()));
create policy stage_questions_admin_read on public.stage_questions for select to authenticated
  using ((select public.is_admin()));

-- ---------- Katılımcı (yalnızca service role) ---------------------------------

create or replace function public.stage_submit(p_name text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[ \t]+', ' ', 'g'));
  v_id uuid;
begin
  if not (select is_open from public.stage_settings where id = 1) then
    raise exception 'ERR_STAGE_CLOSED' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 3 or char_length(v_body) > 600 or char_length(coalesce(v_name, '')) > 60 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  insert into public.stage_questions (author_name, body) values (v_name, v_body) returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.stage_submit(text, text) from public, anon, authenticated;
grant execute on function public.stage_submit(text, text) to service_role;

-- ---------- Admin ------------------------------------------------------------

create or replace function public.admin_stage_set_open(p_open boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
begin
  if p_open is null then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  update public.stage_settings set is_open = p_open, updated_at = now() where id = 1;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, case when p_open then 'stage_open' else 'stage_close' end, '{}'::jsonb);
  return p_open;
end;
$$;

-- Durum değiştirir. 'merged' bu yoldan verilemez (admin_stage_merge kullanılır).
-- Birleştirilmiş bir soru başka duruma alınırsa birleştirmeden çıkar.
-- Bir sorunun durumu değişince ona birleştirilmiş sorular ona bağlı kalır (sayısı görünür).
create or replace function public.admin_stage_set_status(p_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
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

-- p_ids içindeki soruları p_target altında birleştirir. Hedef birleştirilmiş bir soru olamaz;
-- birleştirilen sorulara daha önce bağlanmış sorular da doğrudan hedefe taşınır.
create or replace function public.admin_stage_merge(p_target uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
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

-- Birleştirme sonrası hedef sorunun metnini sadeleştirmek için.
create or replace function public.admin_stage_update_body(p_id uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
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

create or replace function public.admin_stage_reset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
  v_count integer;
begin
  update public.stage_questions set merged_into = null, status = 'archived' where merged_into is not null;
  delete from public.stage_questions where true;
  get diagnostics v_count = row_count;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'stage_reset', jsonb_build_object('deleted', v_count));
  return v_count;
end;
$$;

revoke execute on function public.admin_stage_set_open(boolean) from public, anon;
revoke execute on function public.admin_stage_set_status(uuid[], text) from public, anon;
revoke execute on function public.admin_stage_merge(uuid, uuid[]) from public, anon;
revoke execute on function public.admin_stage_update_body(uuid, text) from public, anon;
revoke execute on function public.admin_stage_reset() from public, anon;
grant execute on function public.admin_stage_set_open(boolean) to authenticated, service_role;
grant execute on function public.admin_stage_set_status(uuid[], text) to authenticated, service_role;
grant execute on function public.admin_stage_merge(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.admin_stage_update_body(uuid, text) to authenticated, service_role;
grant execute on function public.admin_stage_reset() to authenticated, service_role;
