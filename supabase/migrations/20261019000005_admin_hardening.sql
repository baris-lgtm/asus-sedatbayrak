-- =============================================================================
-- 0005: Admin paneli sağlamlaştırma
--  * Türkçe büyük/küçük harf duyarsız arama (İ/i, I/ı, Ş/ş … aynı kabul edilir)
--  * event_settings.info_changed_at: yalnızca katılımcıya gösterilen tarih/mekân
--    bilgisi değişince ilerler (kapasite vb. kaydetmek yeni bilgilendirme turu açmaz)
--  * Bilgilendirme hedef listesi SQL'de hesaplanır (PostgREST 1000 satır sınırı yok)
-- =============================================================================

-- ---------- Türkçe katlama --------------------------------------------------
-- Arama için gevşek eşleştirme: tüm I/İ/ı/i → i, Ş→s, Ğ→g, Ü→u, Ö→o, Ç→c, sonra küçük harf.
-- Uygulamadaki src/lib/admin/queries.ts → trFold() ile BİREBİR aynı olmalı.
create or replace function public.tr_fold(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(p, ''), 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'iiissgguuooccaaiiuu'))
$$;

alter table public.applications
  add column search_text text generated always as (
    public.tr_fold(first_name || ' ' || last_name || ' ' || email || ' ' || phone || ' '
                   || coalesce(institution, '') || ' ' || coalesce(department, ''))
  ) stored;

grant select (search_text) on public.applications to authenticated;

-- ---------- Bilgi değişim zamanı --------------------------------------------
alter table public.event_settings add column info_changed_at timestamptz not null default now();
grant select (info_changed_at) on public.event_settings to anon, authenticated;

create or replace function public.tg_event_settings_info_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.starts_at, new.ends_at, new.date_confirmed, new.venue_name, new.venue_address,
      new.venue_map_url, new.transport_info, new.venue_confirmed)
     is distinct from
     (old.starts_at, old.ends_at, old.date_confirmed, old.venue_name, old.venue_address,
      old.venue_map_url, old.transport_info, old.venue_confirmed) then
    new.info_changed_at := now();
  end if;
  -- Aksi hâlde değer korunur (istemci rollerinin bu sütuna yazma yetkisi yoktur).
  return new;
end;
$$;

create trigger event_settings_info_changed
  before update on public.event_settings
  for each row execute function public.tg_event_settings_info_changed();

-- ---------- Bilgilendirme hedefleri -----------------------------------------
-- Onaylı (giriş yapmamış) ve aktif davetiyesi olan herkes; "informed" =
--   bu sürüm için event_update e-postası başarıyla gitmiş  VEYA
--   bilgi son değiştikten sonra davetiye e-postası (güncel bilgiyle) başarıyla gitmiş.
-- Sıralama sabittir (onay sırası) → turlar deterministik ilerler.
create or replace function public.admin_event_update_targets(p_version text)
returns table (application_id uuid, invitation_id uuid, informed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  perform public._require_admin();
  if p_version is null or p_version !~ '^[0-9a-f]{8,64}$' then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;
  select info_changed_at into v_since from public.event_settings where id = 1;

  return query
  select i.application_id,
         i.id,
         exists (
           select 1 from public.email_logs l
            where l.application_id = i.application_id
              and l.status = 'sent'
              and (
                    l.dedupe_key = 'event_update:' || i.application_id::text || ':' || p_version
                 or (l.email_type in ('invitation', 'invitation_resend')
                     and l.invitation_id = i.id
                     and l.sent_at >= v_since)
              )
         )
    from public.invitations i
    join public.applications a on a.id = i.application_id
   where i.revoked_at is null
     and a.status = 'approved'
   order by i.issued_at, i.id;
end;
$$;

revoke execute on function public.admin_event_update_targets(text) from public, anon;
grant execute on function public.admin_event_update_targets(text) to authenticated, service_role;
revoke execute on function public.tr_fold(text) from public, anon;
grant execute on function public.tr_fold(text) to authenticated, service_role;

-- ---------- check_in: tekrar okutmada "az önce" bilgisi -----------------
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
                              'checked_in_at', v_inv.checked_in_at,
                              -- Aynı personel kısa süre önce kendisi okuttuysa arayüz bunu
                              -- "az önce giriş yaptı" olarak (alarm vermeden) gösterir.
                              'by_me', v_inv.checked_in_by = v_uid,
                              'seconds_ago', floor(extract(epoch from now() - v_inv.checked_in_at))::int);
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('result', 'revoked');
  end if;
  return jsonb_build_object('result', 'not_approved');
end;
$$;

