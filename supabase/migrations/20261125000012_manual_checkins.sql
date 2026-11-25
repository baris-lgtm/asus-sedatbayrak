-- Kapıda QR okutulmadan, sayılarak alınan katılımcılar (21 Kasım etkinliği: liste tutulamadı, yalnızca sayı).
-- Kişi kayıtlarına DOKUNULMAZ: kimse "giriş yaptı" diye işaretlenmez; yalnızca ayrı bir sayı tutulur ve
-- panelde toplam katılım = QR ile giriş + kapıda sayılan olarak gösterilir.

alter table public.event_settings
  add column if not exists manual_checkins integer not null default 0 check (manual_checkins between 0 and 5000),
  add column if not exists manual_checkins_note text check (char_length(manual_checkins_note) <= 200);

create or replace function public.admin_set_manual_checkins(p_count integer, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
  v_old integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_count is null or p_count < 0 or p_count > 5000 or char_length(coalesce(v_note, '')) > 200 then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  select manual_checkins into v_old from public.event_settings where id = 1 for update;
  update public.event_settings
     set manual_checkins = p_count, manual_checkins_note = v_note, updated_by = v_uid
   where id = 1;
  insert into public.admin_audit_logs (admin_user_id, action, metadata)
  values (v_uid, 'set_manual_checkins', jsonb_build_object('from', v_old, 'to', p_count));
  return p_count;
end;
$$;
revoke execute on function public.admin_set_manual_checkins(integer, text) from public, anon;
grant execute on function public.admin_set_manual_checkins(integer, text) to authenticated, service_role;

-- Panel istatistiklerine kapıda sayılan girişi ekle (diğer alanlar aynı).
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object(
           'total',      count(*),
           'pending',    count(*) filter (where status = 'pending'),
           'reviewing',  count(*) filter (where status = 'reviewing'),
           'approved',   count(*) filter (where status = 'approved'),
           'waitlisted', count(*) filter (where status = 'waitlisted'),
           'rejected',   count(*) filter (where status = 'rejected'),
           'cancelled',  count(*) filter (where status = 'cancelled'),
           'checked_in', count(*) filter (where status = 'checked_in'),
           'capacity',   (select capacity from public.event_settings where id = 1),
           'manual_checkins', (select manual_checkins from public.event_settings where id = 1),
           'manual_checkins_note', (select manual_checkins_note from public.event_settings where id = 1),
           'failed_emails', (select count(*) from public.email_logs where status = 'failed')
         )
    into v_result
    from public.applications;
  return v_result;
end;
$$;
