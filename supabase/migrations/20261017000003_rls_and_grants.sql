-- =============================================================================
-- 0003: Row Level Security ve yetkiler
--
-- İlke: "varsayılan olarak reddet".
--  * anon (ziyaretçi): yalnızca event_settings okuyabilir. Başvurular anon
--    anahtarıyla DOĞRUDAN yazılamaz; rate-limit + Zod doğrulamalı sunucu
--    rotası (service_role) üzerinden kaydedilir. Böylece public anahtarla
--    spam / doğrulama atlatma mümkün değildir.
--  * authenticated: RLS ile yalnızca admin olan okuyabilir. Yazma işlemleri
--    yalnızca SECURITY DEFINER fonksiyonlarla (yetki kontrollü) yapılır.
--  * service_role: RLS'i atlar; anahtar ASLA istemciye gönderilmez.
-- =============================================================================

alter table public.event_settings   enable row level security;
alter table public.staff_members    enable row level security;
alter table public.applications     enable row level security;
alter table public.invitations      enable row level security;
alter table public.email_logs       enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.rate_limits      enable row level security;

-- ---------- Tablo yetkileri (RLS'e ek savunma katmanı) ----------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.event_settings to anon, authenticated;
grant update (event_name, starts_at, ends_at, date_confirmed, venue_name, venue_address,
              venue_map_url, transport_info, venue_confirmed, capacity, applications_open,
              kvkk_notice_version, marketing_consent_version, retention_days, updated_by)
  on public.event_settings to authenticated;

grant select on public.staff_members    to authenticated;
grant select on public.applications     to authenticated;
grant select on public.invitations      to authenticated;
grant select on public.email_logs       to authenticated;
grant select on public.admin_audit_logs to authenticated;
-- rate_limits: hiçbir istemci rolüne yetki yok.

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- Politikalar ------------------------------------------------------
-- event_settings: herkese açık bilgi (tarih, mekân, kapasite).
create policy event_settings_read_all
  on public.event_settings for select
  to anon, authenticated
  using (true);

create policy event_settings_admin_update
  on public.event_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- staff_members: kişi yalnızca kendi rolünü görür; admin herkesi görür.
create policy staff_members_read_self_or_admin
  on public.staff_members for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Kişisel veri içeren tablolar: yalnızca admin okur.
create policy applications_admin_read
  on public.applications for select
  to authenticated
  using ((select public.is_admin()));

create policy invitations_admin_read
  on public.invitations for select
  to authenticated
  using ((select public.is_admin()));

create policy email_logs_admin_read
  on public.email_logs for select
  to authenticated
  using ((select public.is_admin()));

create policy admin_audit_logs_admin_read
  on public.admin_audit_logs for select
  to authenticated
  using ((select public.is_admin()));

-- ---------- Fonksiyon yetkileri ---------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_staff_role()  to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.is_staff()            to authenticated;
grant execute on function public.admin_set_status(uuid, public.application_status, text) to authenticated;
grant execute on function public.admin_approve(uuid, uuid, text, text)                  to authenticated;
grant execute on function public.admin_reissue_invitation(uuid, uuid, text, text)       to authenticated;
grant execute on function public.check_in(text, text)                                   to authenticated;
grant execute on function public.admin_stats()                                          to authenticated;

grant execute on all functions in schema public to service_role;

-- Yeni oluşturulacak fonksiyonlar otomatik olarak herkese açılmasın.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
