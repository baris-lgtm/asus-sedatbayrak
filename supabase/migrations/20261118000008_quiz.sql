-- Etkinlik günü quizi ve liderlik tablosu.
--  * Katılımcı yalnızca ad soyad girer; quiz_attempts satırı yalnızca service role
--    (API rotaları) üzerinden yazılır. anon/authenticated yazamaz.
--  * Süre DB saatinden hesaplanır (started_at → finished_at); istemciye güvenilmez.
--  * Her deneme yalnızca bir kez tamamlanabilir.
--  * Admin quizi açar/kapatır, tek denemeyi siler veya tümünü sıfırlar (kendi oturumuyla).

create table public.quiz_settings (
  id         smallint primary key default 1 check (id = 1),
  is_open    boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.quiz_settings (id) values (1) on conflict do nothing;

create table public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (char_length(full_name) between 3 and 80),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     integer check (duration_ms >= 0),
  correct_count   integer check (correct_count >= 0),
  total_questions integer check (total_questions > 0),
  -- [{ "q": "<soru id>", "chosen": 0..3 | null, "correct": bool }, ...]
  answers         jsonb,
  constraint quiz_attempts_finished_consistent check (
    (finished_at is null) = (duration_ms is null)
    and (finished_at is null) = (correct_count is null)
  )
);
create index quiz_attempts_rank_idx on public.quiz_attempts (correct_count desc, duration_ms asc, finished_at asc)
  where finished_at is not null;

alter table public.quiz_settings enable row level security;
alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_settings, public.quiz_attempts from anon, authenticated;
grant select on public.quiz_settings, public.quiz_attempts to authenticated;
grant all on public.quiz_settings, public.quiz_attempts to service_role;

create policy quiz_settings_admin_read on public.quiz_settings for select to authenticated
  using ((select public.is_admin()));
create policy quiz_attempts_admin_read on public.quiz_attempts for select to authenticated
  using ((select public.is_admin()));

-- ---------- Katılımcı tarafı (yalnızca service role) -------------------------

create or replace function public.quiz_start(p_full_name text)
returns table (attempt_id uuid, started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
begin
  if not (select is_open from public.quiz_settings where id = 1) then
    raise exception 'ERR_QUIZ_CLOSED' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 80 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  return query
    insert into public.quiz_attempts as q (full_name) values (v_name)
    returning q.id, q.started_at;
end;
$$;

-- Sıra: doğru sayısı (çok → az), süre (kısa → uzun), bitiriş zamanı (erken → geç).
create or replace function public.quiz_rank_of(p_attempt uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + count(*)::int
    from public.quiz_attempts o, public.quiz_attempts me
   where me.id = p_attempt
     and me.finished_at is not null
     and o.finished_at is not null
     and o.id <> me.id
     and (o.correct_count > me.correct_count
          or (o.correct_count = me.correct_count and o.duration_ms < me.duration_ms)
          or (o.correct_count = me.correct_count and o.duration_ms = me.duration_ms
              and (o.finished_at, o.id) < (me.finished_at, me.id)));
$$;

create or replace function public.quiz_finish(p_attempt uuid, p_correct integer, p_total integer, p_answers jsonb)
returns table (duration_ms integer, correct_count integer, total_questions integer, rank integer, already boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.quiz_attempts;
  v_already boolean := false;
begin
  if p_correct is null or p_total is null or p_correct < 0 or p_total <= 0 or p_correct > p_total
     or jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;

  select * into v_row from public.quiz_attempts where id = p_attempt for update;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.finished_at is not null then
    v_already := true;
  else
    if not (select is_open from public.quiz_settings where id = 1) then
      raise exception 'ERR_QUIZ_CLOSED' using errcode = 'P0001';
    end if;
    update public.quiz_attempts q
       set finished_at = now(),
           duration_ms = greatest(0, (extract(epoch from (now() - q.started_at)) * 1000)::integer),
           correct_count = p_correct,
           total_questions = p_total,
           answers = p_answers
     where q.id = p_attempt
    returning * into v_row;
  end if;

  return query select v_row.duration_ms, v_row.correct_count, v_row.total_questions,
                      public.quiz_rank_of(v_row.id), v_already;
end;
$$;

create or replace function public.quiz_leaderboard(p_limit integer default 50)
returns table (rank integer, attempt_id uuid, full_name text, correct_count integer, total_questions integer,
               duration_ms integer, finished_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select (row_number() over (order by q.correct_count desc, q.duration_ms asc, q.finished_at asc, q.id asc))::int,
         q.id, q.full_name, q.correct_count, q.total_questions, q.duration_ms, q.finished_at
    from public.quiz_attempts q
   where q.finished_at is not null
   order by q.correct_count desc, q.duration_ms asc, q.finished_at asc, q.id asc
   limit least(greatest(coalesce(p_limit, 50), 1), 500);
$$;

revoke execute on function public.quiz_start(text) from public, anon, authenticated;
revoke execute on function public.quiz_rank_of(uuid) from public, anon, authenticated;
revoke execute on function public.quiz_finish(uuid, integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.quiz_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.quiz_start(text) to service_role;
grant execute on function public.quiz_rank_of(uuid) to service_role;
grant execute on function public.quiz_finish(uuid, integer, integer, jsonb) to service_role;
grant execute on function public.quiz_leaderboard(integer) to service_role;

-- ---------- Admin (kendi oturumuyla; yetki fonksiyonda da kontrol edilir) -----

create or replace function public.admin_quiz_set_open(p_open boolean)
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
  update public.quiz_settings set is_open = p_open, updated_at = now() where id = 1;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, case when p_open then 'quiz_open' else 'quiz_close' end, '{}'::jsonb);
  return p_open;
end;
$$;

create or replace function public.admin_quiz_delete_attempt(p_attempt uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
begin
  delete from public.quiz_attempts where id = p_attempt;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'quiz_delete_attempt', '{}'::jsonb);
  return true;
end;
$$;

create or replace function public.admin_quiz_reset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
  v_count integer;
begin
  delete from public.quiz_attempts where true;
  get diagnostics v_count = row_count;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'quiz_reset', jsonb_build_object('deleted', v_count));
  return v_count;
end;
$$;

revoke execute on function public.admin_quiz_set_open(boolean) from public, anon;
revoke execute on function public.admin_quiz_delete_attempt(uuid) from public, anon;
revoke execute on function public.admin_quiz_reset() from public, anon;
grant execute on function public.admin_quiz_set_open(boolean) to authenticated, service_role;
grant execute on function public.admin_quiz_delete_attempt(uuid) to authenticated, service_role;
grant execute on function public.admin_quiz_reset() to authenticated, service_role;
