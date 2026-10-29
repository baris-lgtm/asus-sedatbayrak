# CLAUDE.md — ASUS × Sedat Bayrak Workshop

Workshop başvuru + admin onayı + QR davetiye + kapıda check-in sistemi. Kullanıcıyla **Türkçe** konuş; arayüz metinleri Türkçe ve "sen" hitabıyla.

## Yığın
Next.js 16 (App Router, Turbopack, `src/proxy.ts` = eski middleware) · React 19 · TypeScript · Tailwind 4 (`src/app/globals.css` içinde `@theme`) · Supabase (Postgres + Auth + RLS, `@supabase/ssr`) · Resend · Zod 4 · react-hook-form · qrcode / qr-scanner · Vitest · Playwright.

## Komutlar
```bash
npm run dev            # geliştirme
npm run build          # üretim derlemesi (TypeScript dahil)
npm test               # birim testleri (Vitest)
npm run test:db        # DB testleri — PGHOST/PGPORT/PGUSER(/PGPASSWORD) gerekir
npm run db:start       # yerel Supabase (Docker); migration'ları uygular
npm run staff:add -- <e-posta> <admin|checkin>   # ekip kullanıcısı ekle / rol güncelle
npm run build && npm run test:e2e   # 33 uçtan uca test — yalnızca YEREL Supabase'e karşı, verileri sıfırlar
```
Yerel Supabase için DB testi: `PGPASSWORD=postgres PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres npm run test:db`

## Bozulmaması gereken güvenlik kuralları
- Başvurular **yalnızca** `src/app/api/applications/route.ts` üzerinden (service role) yazılır. anon/authenticated rollerinin `applications` tablosuna yazma yetkisi verilmez.
- DB tetikleyicisi yeni başvuruyu daima `pending` yapar — otomatik onay eklenmez.
- Admin rolü yalnızca `staff_members` tablosundan okunur (`src/lib/auth.ts`); `user_metadata` kullanılmaz.
- Her server action / admin API önce `requireAdmin()` veya `requireStaff()` çağırır, değişikliği **kullanıcının kendi oturumuyla** Postgres fonksiyonu üzerinden yapar (`admin_approve`, `admin_set_status`, `admin_reissue_invitation`, `check_in`). Fonksiyonlar yetkiyi ayrıca kontrol eder.
- Kapasite, onay idempotency ve tek-giriş kuralları **veritabanında** (`supabase/migrations/…0002_functions.sql`). Frontend'e taşınmaz.
- QR token = HMAC(`INVITATION_TOKEN_SECRET`, davetiye_id); DB'de yalnızca SHA-256 hash. QR/URL'ye kişisel veri konmaz.
- `SUPABASE_SERVICE_ROLE_KEY` ve diğer sırlar asla `NEXT_PUBLIC_` olmaz; service client yalnızca `src/lib/supabase/admin.ts` (`server-only`).
- Loglara kişisel veri (e-posta, telefon, ad) yazılmaz.
- E-posta: `claim_email`/`finish_email` ile dedupe; yalnızca sağlayıcı başarı dönerse `sent`. E-posta hatası başvuruyu asla geri almaz.
- Şema değişikliği = **yeni** migration dosyası (`supabase/migrations/<zaman>_<ad>.sql`); mevcut migration'lar düzenlenmez (canlıya uygulanmış olabilir). Değişiklikten sonra `tests/db` testleri güncellenip çalıştırılır.

## Önemli dosyalar
- `src/config/event.ts` — statik içerik (program, konuşmacılar, ürün, görseller, iletişim, KVKK onay bayrakları).
- Başvuru formu: tek "Ad Soyad" alanı (son kelime soyad → first_name/last_name), Kurum/Okul, `additional_answers.tools` ve `.portfolio` (isteğe bağlı) ve `additional_answers.motivation` (zorunlu); `department` artık boş. Landing metinleri "siz" hitabıyla.
- Hukuki metinler: `src/content/legal.ts` (ASUS'tan gelen KVKK Aydınlatma Metni + Gizlilik Politikası, 29 Ekim 2026). Metne dokunmadan önce hukuk onayı; değişince admin'den KVKK sürümünü artır.
- Saklama: `purge_expired_applications()` etkinlik tarihinden (`starts_at`, `date_confirmed`) itibaren `retention_days` (365) sonra tüm başvuruları siler (migration 0006).
- `event_settings` tablosu — tarih/mekân/kapasite (admin panelinden `/admin/ayarlar`). `*_confirmed` false ise bilgi gösterilmez.
- `src/lib/email/` — şablonlar, gönderim, bildirimler.
- `src/app/admin/actions.ts` — tüm admin işlemleri.
- `tests/e2e/` — Playwright; `EMAIL_TEST_SINK_DIR` ile e-postalar diske yazılır (yalnızca localhost'ta etkin).

## Bilinen tuzaklar
- Supabase istemcileri `src/lib/supabase/fetch.ts` üzerinden çalışır: zaman aşımı + `cache: "no-store"`. Admin/e-posta yolunda Next veri önbelleği KULLANILMAZ (eski ayarla e-posta gitmesin). Yalnızca herkese açık sayfalar `getEventSettings()` ile 60 sn önbellekli okur; e-postalar `getEventSettingsStrict()`.
- Arama `applications.search_text` (tr_fold) sütununda; `trFold()` (TS) ile `public.tr_fold()` (SQL) birebir aynı kalmalı.
- error.tsx'te `retry()` kullan (sunucudan yeniden çeker); `reset()` çekmez.
- Testlerde `page.reload()` sonrası `count()` kullanmadan önce sayfanın akışının bittiğini bir metinle bekle (loading.tsx streaming).
- Supabase'de "Allow new users to sign up" KAPALI olmalı ama **Email provider açık** kalmalı (yerelde `config.toml`: `[auth] enable_signup=false`, `[auth.email] enable_signup=true`).
- `NEXT_PUBLIC_*` değişkenleri derleme anında gömülür → değiştirince yeniden deploy.
- `INVITATION_TOKEN_SECRET` değişirse gönderilmiş tüm QR'lar geçersiz olur.
- Kamera yalnızca https (veya localhost) üzerinde çalışır.

## Kurulum kararları (20 Ekim 2026)
- Site adresi: `https://workshop.contracreative.com.tr` → `NEXT_PUBLIC_SITE_URL`, Supabase Auth Site URL. DNS: `workshop` CNAME → Vercel'in verdiği hedef.
- Gönderici (şimdilik): `EMAIL_FROM="ASUS × Sedat Bayrak Workshop <baris@contracreative.com.tr>"`, `EMAIL_REPLY_TO=baris@contracreative.com.tr` (gerçek posta kutusu; katılımcı yanıtları buraya gelir). İleride workshop@ açılırsa yalnızca bu iki ortam değişkeni değişir + redeploy; kod değişmez. Resend'de doğrulanan domain: `contracreative.com.tr` (bölge eu-west-1). Resend'in kayıtları `send.` ve `resend._domainkey` altında olduğundan şirketin mevcut e-posta (MX) kayıtlarına dokunulmaz.
- Planlar: Supabase Pro + Vercel Pro hemen; Resend başvurular duyurulmadan önce Pro (ücretsizde günlük 100 e-posta sınırı).

## Canlı Supabase (20 Ekim 2026)
- Proje: `https://jzzrrknyxrqlfprqmnen.supabase.co` (Frankfurt). 5 migration SQL Editor ile uygulandı (`supabase-kurulum.sql`), canlı doğrulama 22/22 geçti; sign-up kapalı; Site URL ayarlı.
- Admin: `baris@contracreative.com.tr` (staff_members.role = admin).
- **Migration geçmişi tabloya kaydedilmedi.** `supabase db push` kullanılacaksa önce: `npx supabase link --project-ref jzzrrknyxrqlfprqmnen` ve `npx supabase migration repair --status applied 20261017000001 20261017000002 20261017000003 20261017000004 20261019000005` — yoksa eski migration'ları yeniden çalıştırmaya çalışır. Yeni migration'lar ayrı dosya olarak eklenir.

## Durum (17 Ekim 2026)
Tüm özellikler tamam (toplu tarih/mekân bilgilendirmesi, KVKK kalıcı silme ve `npm run staff:add` dahil); 93 DB + 13 birim + 56 E2E testi geçiyor (admin paneli iki bağımsız incelemeden geçti); `next build` temiz.
**Sıradaki iş: canlıya alma** (README → "Canlıya alma"):
1. Supabase projesi (Frankfurt) → `npx supabase link --project-ref <ref>` → `npx supabase db push` → sign-up kapat → `npm run staff:add -- <e-posta> admin`.
2. GitHub reposu → Vercel'e import → ortam değişkenleri (`.env.example`) → Functions bölgesi `fra1`.
3. Resend domain doğrulama → `RESEND_API_KEY`, `EMAIL_FROM`.
4. Alan adı → `NEXT_PUBLIC_SITE_URL` güncelle + redeploy → Supabase Site URL.
5. Canlı duman testi: başvur → onayla → telefonda QR okut → ikinci okutma engellenmeli.

Görseller (29 Ekim): `public/images/*.webp` tasarım yerleşim PNG'lerinden kesildi, `public/media/hero-eskizden-mimariye.mp4` açılış videosu (son karesi = hero-poster). Konuşmacı portreleri sedat/omer/fatih `-v2` = gerçek fotoğraflar (29 Ekim); Mesut hâlâ taslak referansı. Ürün: ASUS resmî dekupe görselleri (`proart-p16-black`, `proart-p16-white-rear`). Logo: `public/brand/asus-white.png` (resmî). Görsel değiştirirken dosya adına yeni sürüm ekle (CDN önbelleği).
Bekleyen içerik: Mesut Çevik portresi, ProArt Design Futures logosu, ProArt P16 ürün linki, sosyal medya linkleri, pazarlama açık rıza + ticari ileti onayı metinleri (hukuktan), çerez politikası. Canlıya 0006 migration'ı SQL Editor ile uygulanmalı.
