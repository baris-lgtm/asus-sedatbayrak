-- =============================================================================
-- 0002: İş kuralı fonksiyonları
-- Kritik işlemler (onay + kapasite, durum değişikliği, check-in) burada ATOMİK
-- olarak ve yetki kontrolüyle yapılır. Sunucu rotaları bu fonksiyonları
-- kullanıcının kendi oturumuyla (authenticated) çağırır; yani yetki hem API
-- rotasında hem veritabanında kontrol edilir.
--
-- Hata kodları istemciye 'ERR_*' mesajı olarak döner (SQLSTATE P0001).
-- =============================================================================

-- ---------- Yetki yardımcıları ----------------------------------------------
create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_members where user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.staff_members where user_id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_members where user_id = auth.uid());
$$;

create or replace function public._require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;
  return v_uid;
end;
$$;

-- ---------- Durum değişikliği (onay ve check-in HARİÇ) -----------------------
-- İzin verilen geçişler:
--   pending | reviewing | waitlisted | rejected -> reviewing | waitlisted | rejected
--   approved                                    -> cancelled (aktif davetiye iptal edilir)
--   pending | reviewing | waitlisted            -> cancelled
-- 'approved' yalnızca admin_approve ile, 'checked_in' yalnızca check_in ile.
-- Aynı duruma geçiş no-op'tur (changed=false) → tekrar e-posta gönderilmez.
create or replace function public.admin_set_status(
  p_application_id uuid,
  p_status         public.application_status,
  p_note           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  v_prev  public.application_status;
begin
  if p_status in ('approved', 'checked_in', 'pending') then
    raise exception 'ERR_INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  select status into v_prev
    from public.applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_prev = p_status then
    return jsonb_build_object('application_id', p_application_id, 'previous_status', v_prev,
                              'status', p_status, 'changed', false);
  end if;

  if not (
       (v_prev in ('pending', 'reviewing', 'waitlisted', 'rejected') and p_status in ('reviewing', 'waitlisted', 'rejected'))
    or (v_prev in ('pending', 'reviewing', 'waitlisted', 'approved') and p_status = 'cancelled')
  ) then
    raise exception 'ERR_INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  if v_prev = 'approved' then
    update public.invitations
       set revoked_at = now(), revoked_by = v_admin, revoke_reason = 'application_' || p_status::text
     where application_id = p_application_id
       and revoked_at is null;
  end if;

  update public.applications
     set status      = p_status,
         reviewed_at = now(),
         reviewed_by = v_admin,
         admin_note  = coalesce(left(p_note, 2000), admin_note)
   where id = p_application_id;

  insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
  values (v_admin, 'status_change', p_application_id,
          jsonb_build_object('from', v_prev, 'to', p_status));

  return jsonb_build_object('application_id', p_application_id, 'previous_status', v_prev,
                            'status', p_status, 'changed', true);
end;
$$;

-- ---------- Onay + kapasite + davetiye (atomik, idempotent) ------------------
-- Sunucu: invitation_id (UUID) ve token hash'lerini üretip gönderir.
-- * event_settings satırı FOR UPDATE ile kilitlenir → eş zamanlı onaylar sıraya
--   girer, kapasite asla aşılamaz.
-- * Başvuru zaten onaylı ve aktif davetiyesi varsa MEVCUT davetiye döner,
--   yeni token oluşturulmaz (created=false).
create or replace function public.admin_approve(
  p_application_id   uuid,
  p_invitation_id    uuid,
  p_qr_token_hash    text,
  p_manual_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin    uuid := public._require_admin();
  v_capacity integer;
  v_status   public.application_status;
  v_existing uuid;
  v_taken    integer;
begin
  -- Global kilit: tüm onaylar sırayla işlenir (300-400 kişilik etkinlik için yeterli).
  select capacity into v_capacity from public.event_settings where id = 1 for update;

  select status into v_status
    from public.applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status in ('approved', 'checked_in') then
    select id into v_existing
      from public.invitations
     where application_id = p_application_id and revoked_at is null;

    if v_existing is not null then
      return jsonb_build_object('application_id', p_application_id, 'invitation_id', v_existing,
                                'created', false, 'status', v_status);
    end if;
    if v_status = 'checked_in' then
      raise exception 'ERR_INVALID_TRANSITION' using errcode = 'P0001';
    end if;
    -- approved ama aktif davetiye yok (beklenmez) → aşağıda yeniden oluşturulur.
  elsif v_status not in ('pending', 'reviewing', 'waitlisted') then
    raise exception 'ERR_INVALID_TRANSITION' using errcode = 'P0001';
  else
    select count(*) into v_taken
      from public.applications
     where status in ('approved', 'checked_in');

    if v_taken >= v_capacity then
      raise exception 'ERR_CAPACITY_FULL' using errcode = 'P0001';
    end if;
  end if;

  insert into public.invitations (id, application_id, qr_token_hash, manual_code_hash, issued_by)
  values (p_invitation_id, p_application_id, p_qr_token_hash, p_manual_code_hash, v_admin);

  update public.applications
     set status = 'approved', reviewed_at = now(), reviewed_by = v_admin
   where id = p_application_id;

  insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
  values (v_admin, 'approve', p_application_id,
          jsonb_build_object('from', v_status, 'invitation_id', p_invitation_id));

  return jsonb_build_object('application_id', p_application_id, 'invitation_id', p_invitation_id,
                            'created', true, 'status', 'approved');
end;
$$;

-- ---------- Davetiyeyi yeniden üret (QR sızdıysa vb.) ------------------------
-- Eski davetiye iptal edilir, yeni token'lı davetiye oluşturulur.
-- (Sadece "QR'ımı kaybettim" durumunda yeniden üretmeye gerek yok; aynı
--  davetiye e-postası tekrar gönderilir.)
create or replace function public.admin_reissue_invitation(
  p_application_id   uuid,
  p_invitation_id    uuid,
  p_qr_token_hash    text,
  p_manual_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := public._require_admin();
  v_status public.application_status;
  v_old    uuid;
begin
  select status into v_status from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status <> 'approved' then
    raise exception 'ERR_INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  update public.invitations
     set revoked_at = now(), revoked_by = v_admin, revoke_reason = 'reissued'
   where application_id = p_application_id and revoked_at is null
  returning id into v_old;

  insert into public.invitations (id, application_id, qr_token_hash, manual_code_hash, issued_by)
  values (p_invitation_id, p_application_id, p_qr_token_hash, p_manual_code_hash, v_admin);

  insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
  values (v_admin, 'reissue_invitation', p_application_id,
          jsonb_build_object('old_invitation_id', v_old, 'invitation_id', p_invitation_id));

  return jsonb_build_object('application_id', p_application_id, 'invitation_id', p_invitation_id,
                            'old_invitation_id', v_old);
end;
$$;

-- ---------- Check-in (tek kullanımlık, yarış koşuluna dayanıklı) ------------
-- Koşullu UPDATE: iki eş zamanlı istekte ikincisi satır kilidini bekler, koşul
-- (checked_in_at is null) artık sağlanmadığı için 0 satır günceller.
-- İlk giriş kaydı (zaman + admin) ASLA değiştirilmez.
-- Dönüş: result = ok | already | revoked | not_approved | invalid
create or replace function public.check_in(
  p_qr_token_hash    text default null,
  p_manual_code_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations%rowtype;
  v_app public.applications%rowtype;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;
  if (p_qr_token_hash is null) = (p_manual_code_hash is null) then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;

  update public.invitations i
     set checked_in_at = now(), checked_in_by = v_uid
   where (i.qr_token_hash = p_qr_token_hash or i.manual_code_hash = p_manual_code_hash)
     and i.revoked_at is null
     and i.checked_in_at is null
     and exists (select 1 from public.applications a
                  where a.id = i.application_id and a.status = 'approved')
  returning i.* into v_inv;

  if found then
    update public.applications set status = 'checked_in'
     where id = v_inv.application_id
    returning * into v_app;

    insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
    values (v_uid, 'check_in', v_inv.application_id,
            jsonb_build_object('invitation_id', v_inv.id,
                               'method', case when p_qr_token_hash is not null then 'qr' else 'manual' end));

    return jsonb_build_object('result', 'ok',
                              'first_name', v_app.first_name, 'last_name', v_app.last_name,
                              'participant_type', v_app.participant_type,
                              'checked_in_at', v_inv.checked_in_at);
  end if;

  -- Başarısız: nedenini belirle (bilgi sızıntısını sınırlı tut).
  select * into v_inv
    from public.invitations i
   where i.qr_token_hash = p_qr_token_hash or i.manual_code_hash = p_manual_code_hash;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into v_app from public.applications where id = v_inv.application_id;

  if v_inv.checked_in_at is not null then
    return jsonb_build_object('result', 'already',
                              'first_name', v_app.first_name, 'last_name', v_app.last_name,
                              'checked_in_at', v_inv.checked_in_at);
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('result', 'revoked');
  end if;
  return jsonb_build_object('result', 'not_approved');
end;
$$;

-- ---------- Dashboard sayıları -----------------------------------------------
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
           'failed_emails', (select count(*) from public.email_logs where status = 'failed')
         )
    into v_result
    from public.applications;
  return v_result;
end;
$$;

-- ---------- Rate limit (yalnızca service_role) -------------------------------
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else r.window_start end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

-- ---------- E-posta gönderim kilidi (yalnızca service_role) -----------------
-- dedupe_key ile kayıt bulunur/oluşturulur ve gönderim "sahiplenilir".
-- Zaten gönderilmiş ('sent') veya şu an başka istek tarafından gönderiliyorsa
-- ('sending', < 5 dk) null döner → çift gönderim olmaz.
-- p_force = true: 'sent' olsa bile yeniden gönderim (admin "tekrar gönder").
create or replace function public.claim_email(
  p_application_id uuid,
  p_email_type     public.email_type,
  p_dedupe_key     text,
  p_invitation_id  uuid default null
)
returns public.email_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.email_logs;
begin
  insert into public.email_logs (application_id, invitation_id, email_type, dedupe_key)
  values (p_application_id, p_invitation_id, p_email_type, p_dedupe_key)
  on conflict (dedupe_key) do nothing;

  update public.email_logs
     set status = 'sending', attempt_count = attempt_count + 1, last_error = null
   where dedupe_key = p_dedupe_key
     and (status in ('pending', 'failed')
          or (status = 'sending' and updated_at < now() - interval '5 minutes'))
  returning * into v_row;

  return v_row; -- null ise: gönderilmiş veya gönderimde
end;
$$;

create or replace function public.finish_email(
  p_log_id              uuid,
  p_success             boolean,
  p_provider_message_id text default null,
  p_error               text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_logs
     set status              = case when p_success then 'sent'::public.email_status else 'failed'::public.email_status end,
         provider_message_id = case when p_success then left(p_provider_message_id, 200) else provider_message_id end,
         sent_at             = case when p_success then now() else null end,
         last_error          = case when p_success then null else left(p_error, 1000) end
   where id = p_log_id and status = 'sending';
end;
$$;

-- ---------- Veri saklama süresi (yalnızca service_role) ----------------------
-- retention_days'ten eski başvuruları (ve cascade ile davetiye/e-posta
-- kayıtlarını) siler. Supabase pg_cron ile periyodik çalıştırılabilir.
create or replace function public.purge_expired_applications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days    integer;
  v_deleted integer;
begin
  select retention_days into v_days from public.event_settings where id = 1;
  delete from public.applications where created_at < now() - make_interval(days => v_days);
  get diagnostics v_deleted = row_count;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_deleted;
end;
$$;
