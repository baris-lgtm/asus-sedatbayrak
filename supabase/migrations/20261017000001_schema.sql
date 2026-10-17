-- =============================================================================
-- ASUS × Sedat Bayrak Workshop — 0001: Şema
-- Tablolar, enum'lar, kısıtlar, indexler ve tetikleyiciler.
-- RLS ve yetkiler 0002'de, iş kuralı fonksiyonları 0003'te.
-- =============================================================================

-- ---------- Enum'lar ---------------------------------------------------------
create type public.application_status as enum (
  'pending',      -- İnceleme bekliyor (başlangıç durumu — DAİMA)
  'reviewing',    -- İnceleniyor
  'approved',     -- Onaylandı (davetiye üretilmiş olmalı)
  'waitlisted',   -- Yedek liste
  'rejected',     -- Reddedildi
  'cancelled',    -- İptal edildi
  'checked_in'    -- Etkinliğe giriş yaptı
);

create type public.participant_type as enum ('student', 'professional', 'academic', 'other');

create type public.email_type as enum (
  'application_received',
  'invitation',
  'invitation_resend',
  'waitlisted',
  'rejected',
  'cancelled'
);

create type public.email_status as enum ('pending', 'sending', 'sent', 'failed', 'skipped');

-- 'admin'  : tüm panel + onay + CSV
-- 'checkin': yalnızca kapı/check-in ekranı (gönüllü/kapı ekibi için)
create type public.staff_role as enum ('admin', 'checkin');

-- ---------- Ortak tetikleyici: updated_at -----------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Etkinlik ayarları (tekil satır) ----------------------------------
-- Tarih/mekân/kapasite kesinleşmediği için koda gömülmez; admin panelinden
-- güncellenir. *_confirmed bayrakları false iken e-postalarda ve sayfada
-- "Kesinleştiğinde duyurulacak" gösterilir — yanlış bilgi gönderilmez.
create table public.event_settings (
  id                 smallint primary key default 1 check (id = 1),
  event_name         text        not null default 'ASUS × Sedat Bayrak Workshop'
                       check (char_length(event_name) between 1 and 120),
  starts_at          timestamptz,
  ends_at            timestamptz,
  date_confirmed     boolean     not null default false,
  venue_name         text check (char_length(venue_name) <= 160),
  venue_address      text check (char_length(venue_address) <= 400),
  venue_map_url      text check (char_length(venue_map_url) <= 1000 and (venue_map_url is null or venue_map_url ~ '^https://')),
  transport_info     text check (char_length(transport_info) <= 2000),
  venue_confirmed    boolean     not null default false,
  capacity           integer     not null default 300 check (capacity between 1 and 5000),
  applications_open  boolean     not null default true,
  -- Formda kullanıcıya gösterilen KVKK aydınlatma metninin sürümü.
  kvkk_notice_version text       not null default 'TASLAK-v0'
                       check (char_length(kvkk_notice_version) between 1 and 40),
  marketing_consent_version text not null default 'TASLAK-v0'
                       check (char_length(marketing_consent_version) between 1 and 40),
  -- Kişisel verilerin saklanma süresi (gün). Gerçek değer hukuk onayıyla belirlenmeli.
  retention_days     integer     not null default 180 check (retention_days between 1 and 3650),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  constraint event_dates_order check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint date_confirmed_needs_date check (not date_confirmed or starts_at is not null),
  constraint venue_confirmed_needs_venue check (not venue_confirmed or (venue_name is not null and venue_address is not null))
);

insert into public.event_settings (id) values (1);

create trigger event_settings_updated_at
  before update on public.event_settings
  for each row execute function public.tg_set_updated_at();

-- ---------- Yetkili personel -------------------------------------------------
-- Admin yetkisi kullanıcı tarafından değiştirilebilen user_metadata'dan DEĞİL,
-- yalnızca service_role / SQL editörü ile yazılabilen bu tablodan okunur.
create table public.staff_members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.staff_role not null default 'checkin',
  created_at timestamptz not null default now()
);

-- ---------- Başvurular -------------------------------------------------------
create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name          text not null check (char_length(btrim(last_name)) between 1 and 80),
  email              text not null check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Mükerrer kontrolü için normalize e-posta (büyük/küçük harf ve boşluk duyarsız).
  email_normalized   text generated always as (lower(btrim(email))) stored,
  phone              text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  participant_type   public.participant_type not null,
  institution        text check (char_length(institution) <= 160),
  department         text check (char_length(department) <= 160),
  additional_answers jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(additional_answers) = 'object' and pg_column_size(additional_answers) < 8192),
  status             public.application_status not null default 'pending',
  kvkk_notice_version  text not null check (char_length(kvkk_notice_version) between 1 and 40),
  kvkk_acknowledged_at timestamptz not null default now(),
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_version text check (char_length(marketing_consent_version) <= 40),
  admin_note         text check (char_length(admin_note) <= 2000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users (id) on delete set null,
  constraint marketing_consent_has_timestamp
    check (marketing_consent = (marketing_consent_at is not null))
);

-- Mükerrer başvuru politikası: aynı e-posta ile yalnızca bir AKTİF başvuru.
-- 'cancelled' başvurular kapsam dışıdır (iptal eden yeniden başvurabilir).
-- Politika değişirse yalnızca bu index'in WHERE koşulu güncellenir.
create unique index applications_email_active_uniq
  on public.applications (email_normalized)
  where status <> 'cancelled';

create index applications_status_created_idx on public.applications (status, created_at desc);
create index applications_created_idx        on public.applications (created_at desc);

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.tg_set_updated_at();

-- Başvuru ekleme kuralları VERİTABANI seviyesinde zorlanır:
--  * Başlangıç durumu daima 'pending' (otomatik onay imkânsız).
--  * İnceleme alanları ve zaman damgaları istemciden gelemez.
--  * Başvurular kapalıysa kayıt reddedilir.
create or replace function public.tg_applications_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_open boolean;
begin
  select applications_open into v_open from public.event_settings where id = 1;
  if not coalesce(v_open, false) then
    raise exception 'ERR_APPLICATIONS_CLOSED' using errcode = 'P0001';
  end if;

  new.status               := 'pending';
  new.reviewed_at          := null;
  new.reviewed_by          := null;
  new.admin_note           := null;
  new.created_at           := now();
  new.updated_at           := now();
  new.kvkk_acknowledged_at := now();
  new.first_name           := btrim(new.first_name);
  new.last_name            := btrim(new.last_name);
  new.email                := btrim(new.email);
  if new.marketing_consent then
    new.marketing_consent_at := now();
  else
    new.marketing_consent_at      := null;
    new.marketing_consent_version := null;
  end if;
  return new;
end;
$$;

create trigger applications_before_insert
  before insert on public.applications
  for each row execute function public.tg_applications_before_insert();

-- ---------- Davetiyeler -------------------------------------------------------
-- Token'ın kendisi SAKLANMAZ; yalnızca SHA-256 hash'i tutulur.
-- id sunucuda üretilir; QR token = HMAC(INVITATION_SECRET, id) olduğundan
-- davetiye tekrar gönderiminde aynı QR yeniden üretilebilir (idempotent),
-- ama veritabanı sızsa bile token'lar elde edilemez.
create table public.invitations (
  id               uuid primary key,
  application_id   uuid not null references public.applications (id) on delete cascade,
  qr_token_hash    text not null unique check (qr_token_hash ~ '^[0-9a-f]{64}$'),
  manual_code_hash text not null unique check (manual_code_hash ~ '^[0-9a-f]{64}$'),
  issued_at        timestamptz not null default now(),
  issued_by        uuid references auth.users (id) on delete set null,
  revoked_at       timestamptz,
  revoked_by       uuid references auth.users (id) on delete set null,
  revoke_reason    text check (char_length(revoke_reason) <= 200),
  checked_in_at    timestamptz,
  checked_in_by    uuid references auth.users (id) on delete set null
);

-- Başvuru başına en fazla BİR aktif (iptal edilmemiş) davetiye.
create unique index invitations_one_active_per_application
  on public.invitations (application_id)
  where revoked_at is null;

create index invitations_application_idx on public.invitations (application_id);

-- ---------- E-posta kayıtları ------------------------------------------------
-- Alıcı adresi burada tutulmaz (başvurudan türetilir) → loglarda kişisel veri yok.
create table public.email_logs (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references public.applications (id) on delete cascade,
  invitation_id       uuid references public.invitations (id) on delete set null,
  email_type          public.email_type not null,
  -- Aynı olayın iki kez e-postalanmasını engeller (örn. 'invitation:<invitation_id>').
  dedupe_key          text unique check (char_length(dedupe_key) <= 200),
  status              public.email_status not null default 'pending',
  provider_message_id text check (char_length(provider_message_id) <= 200),
  attempt_count       integer not null default 0 check (attempt_count >= 0),
  last_error          text check (char_length(last_error) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  sent_at             timestamptz,
  constraint sent_has_timestamp check ((status = 'sent') = (sent_at is not null))
);

create index email_logs_application_idx on public.email_logs (application_id, created_at desc);
create index email_logs_status_idx      on public.email_logs (status) where status in ('failed', 'pending', 'sending');

create trigger email_logs_updated_at
  before update on public.email_logs
  for each row execute function public.tg_set_updated_at();

-- ---------- Admin denetim kayıtları ------------------------------------------
create table public.admin_audit_logs (
  id             bigint generated always as identity primary key,
  admin_user_id  uuid references auth.users (id) on delete set null,
  action         text not null check (char_length(action) between 1 and 60),
  application_id uuid references public.applications (id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index admin_audit_logs_application_idx on public.admin_audit_logs (application_id, created_at desc);
create index admin_audit_logs_created_idx     on public.admin_audit_logs (created_at desc);

-- ---------- Rate limit (serverless uyumlu, DB tabanlı) ----------------------
-- key: amaç + IP'nin HMAC'i (ham IP saklanmaz).
create table public.rate_limits (
  key          text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits         integer not null
);
