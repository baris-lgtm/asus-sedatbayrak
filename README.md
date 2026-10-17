# ASUS × Sedat Bayrak Workshop — Başvuru ve Katılımcı Yönetimi

Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Resend · Vercel

## Durum

| Aşama | Durum |
|---|---|
| 1. İnceleme / mimari | ✅ |
| 2. Veritabanı + güvenlik (migration, RLS, atomik fonksiyonlar) | ✅ yerel PostgreSQL 16'da test edildi |
| Çekirdek yardımcılar (QR token, CSV, telefon) | ✅ birim testli |
| 3–6. Next.js uygulaması, e-posta, check-in UI, deploy | ⏳ npm erişimi bekleniyor |

## Mimari kararlar

- **Başvurular yalnızca sunucu rotasından yazılır.** Public (anon) anahtarın `applications` tablosuna yazma yetkisi yok; böylece rate limit, CAPTCHA ve Zod doğrulaması atlatılamaz.
- **Otomatik onay imkânsız:** `applications` INSERT tetikleyicisi durumu daima `pending` yapar.
- **Admin yetkisi** kullanıcı metadata'sından değil, istemcinin yazamadığı `staff_members` tablosundan okunur. Roller: `admin` (her şey), `checkin` (yalnızca kapı ekranı).
- **Kritik işlemler Postgres fonksiyonlarında atomik:**
  - `admin_approve` — kapasite kontrolü (global satır kilidi), onay ve davetiye tek işlemde; tekrar çağrıda aynı davetiye döner.
  - `admin_set_status` — izinli durum geçişleri, denetim kaydı; onaylı iptal edilirse davetiye de iptal.
  - `check_in` — koşullu UPDATE ile tek kullanımlık giriş; ilk kayıt asla değişmez.
  - `claim_email` / `finish_email` — e-posta çift gönderim kilidi, başarısız gönderim logu ve tekrar deneme.
- **QR token:** `HMAC(INVITATION_TOKEN_SECRET, davetiye_id)`; DB'de yalnızca SHA-256 hash. QR'da kişisel veri yok. Kapı için ayrıca 10 karakterlik manuel kod (ör. `7K3M-Q9TR-2X`).
- **Tarih/mekân/kapasite** `event_settings` tablosunda, admin panelinden düzenlenir. `date_confirmed` / `venue_confirmed` false iken e-postalara ve sayfaya kesin bilgi yazılmaz.

## Veritabanı kurulumu (Supabase)

1. Supabase'de proje oluşturun.
2. `supabase/migrations/` altındaki dosyaları **sırayla** SQL Editor'de çalıştırın (veya `supabase db push`).
3. Authentication → Users altında admin kullanıcısını oluşturun (e-posta + parola). Public sign-up'ı kapatın (Authentication → Providers → Email → "Allow new users to sign up" kapalı).
4. SQL Editor'de admin yetkisini verin:
   ```sql
   insert into public.staff_members (user_id, role)
   select id, 'admin' from auth.users where email = 'admin@ornek.com';
   -- Kapı ekibi için: role = 'checkin'
   ```
5. Etkinlik bilgilerini girin (sonradan admin panelinden de yapılabilecek):
   ```sql
   update public.event_settings set capacity = 300 where id = 1;
   ```

## Testleri çalıştırma

```bash
# Veritabanı: güvenlik, RLS, iş kuralları + eş zamanlılık (PostgreSQL 15+ gerekir)
PGHOST=localhost PGPORT=5432 PGUSER=postgres bash tests/db/run.sh

# Bağımlılıksız birim testleri (Node 22.18+)
node --test tests/unit/core.test.ts
```

`tests/db/00_supabase_shim.sql` yalnızca yerel test içindir (Supabase'in `auth.uid()`, `anon`, `authenticated`, `service_role` yapılarını taklit eder); Supabase'e uygulanmaz.

## Hukuki not

KVKK uyumu yalnızca yazılımla sağlanamaz. Aydınlatma metni, pazarlama izni metni, veri sorumlusu bilgileri ve saklama süresi (`event_settings.retention_days`, varsayılan 180 gün) hukuk danışmanınızdan alınmalıdır. Onaylı metinler gelene kadar formda **TASLAK** uyarısı gösterilir.
