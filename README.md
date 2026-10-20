# ASUS × Sedat Bayrak Workshop — Başvuru ve Katılımcı Yönetimi

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + RLS) · Resend · Vercel

Gerçek başvuru alan, admin onayıyla katılımcı kabul eden, QR kodlu davetiye gönderen ve kapıda tek kullanımlık check-in yapan MVP.

## Sayfalar

| Yol | Kim | Ne |
|---|---|---|
| `/` | Herkes | Landing page + başvuru formu |
| `/kvkk`, `/gizlilik` | Herkes | Yasal metin iskeleti (**TASLAK**, hukuk onaylı metin bekleniyor) |
| `/davetiye/<token>` | Davetiye sahibi | QR + giriş kodu (QR'ını kaybedenler için) |
| `/admin/login` | Ekip | Giriş |
| `/admin` | admin | Dashboard, arama, filtre, sıralama, sayfalama, CSV |
| `/admin/basvurular/<id>` | admin | Detay, onay/ret/yedek/iptal, davetiye tekrar gönder/yeniden üret, e-posta logları + tekrar dene, KVKK talebiyle kalıcı silme |
| `/admin/ayarlar` | admin | Tarih, mekân, kapasite, başvuru açık/kapalı, KVKK sürümü, saklama süresi; tarih/mekân kesinleşince onaylı katılımcılara toplu bilgilendirme (25'erli turlar, kişi başı tek e-posta) |
| `/admin/check-in` | admin, checkin | Kamera ile QR okutma + manuel kod |

## Güvenlik mimarisi (özet)

- **Başvurular yalnızca sunucu rotasından yazılır** (`/api/applications`): köken kontrolü → boyut sınırı → honeypot → IP ve e-posta rate limit (DB tabanlı, serverless uyumlu) → opsiyonel Turnstile → Zod → kayıt. Public anahtarın `applications` tablosuna hiçbir yetkisi yok.
- **Otomatik onay imkânsız**: INSERT tetikleyicisi durumu daima `pending` yapar.
- **Yetki iki katmanlı**: her sayfa/action/API `requireAdmin`/`requireStaff` ile doğrulanmış JWT (`getClaims`) + `staff_members` tablosundan rol okur; ayrıca tüm değişiklikler kullanıcının kendi oturumuyla `SECURITY DEFINER` Postgres fonksiyonlarından geçer ve fonksiyon da yetkiyi kontrol eder. Rol asla `user_metadata`'dan okunmaz.
- **Atomik iş kuralları** (Postgres): `admin_approve` (kapasite + onay + davetiye, global satır kilidi, idempotent), `admin_set_status`, `check_in` (koşullu UPDATE, ilk kayıt değişmez), `claim_email`/`finish_email` (çift gönderim kilidi).
- **QR**: `HMAC(INVITATION_TOKEN_SECRET, davetiye_id)`; DB'de yalnızca SHA-256 hash. QR'da kişisel veri yok. Kapı için 10 karakterlik manuel kod.
- **Loglarda kişisel veri yok**; `email_logs` alıcı adresi tutmaz. CSV formül enjeksiyonuna karşı korumalı, yalnızca admin, her indirme denetim kaydına yazılır.
- Güvenlik başlıkları (`frame-ancestors 'none'`, `nosniff`, HSTS, kamera yalnızca kendi origin), davetiye sayfasında `no-referrer` + `noindex`.

## Yerel geliştirme

Gereksinimler: Node 20.9+ (22 önerilir), Docker (yerel Supabase için).

```bash
npm install
npm run db:start            # yerel Supabase; migration'lar otomatik uygulanır, çıktıdaki anahtarları not alın
cp .env.example .env.local  # değerleri doldurun (yerelde EMAIL_TEST_SINK_DIR açabilirsiniz)
npm run dev
```

Admin kullanıcısı: Supabase Studio veya `auth.admin.createUser` ile kullanıcı oluşturup SQL ile rol verin (aşağıda).

## Testler

| Komut | Ne test eder | Gerçek mi? |
|---|---|---|
| `npm test` | Token/QR, manuel kod, CSV enjeksiyonu, telefon normalize (Vitest) | Birim |
| `npm run test:db` | 93 kontrol: RLS, yetkiler, durum geçişleri, KVKK silme, Türkçe arama katlaması, bilgilendirme hedefleri (1500+ e-posta kaydıyla), idempotent onay, kapasite, check-in, e-posta kilidi, rate limit, saklama + **eş zamanlılık** (30 paralel onay, 20 paralel check-in). `PGHOST/PGPORT/PGUSER` gerekir | Gerçek PostgreSQL (16 ve Supabase 17'de geçti) |
| `npm run build && npm run test:e2e` | 56 uçtan uca senaryo (Playwright, masaüstü + Pixel 7): form, doğrulama, mükerrer, ağ hatası, honeypot, köken, rate limit, yetkisiz erişim, rol ayrımı, onay → QR e-postası → davetiye sayfası, çift sekme idempotency, ret/yedek/iptal, tekrar gönder/yeniden üret, kapasite (6 eş zamanlı sekme), ayarlar, toplu bilgilendirme, KVKK silme, ekip ekleme komutu, paylaşım görseli, Türkçe arama, sayfalama sınırı, oturum düşmesi, ağ kesintisi, **Supabase kesintisi (ağ geçidi durdurularak)**, askıda kalan check-in isteği, tekrar okutma, çevrimdışı uyarısı, Resend hata senaryosu + tekrar dene, manuel ve **sahte kamera ile gerçek QR okutma**, 15 paralel check-in, kamera izni reddi, mobil düzen | Gerçek yerel Supabase (Auth + PostgREST + RLS) + üretim derlemesi |

E2E testleri yalnızca yerel Supabase'e karşı çalışır (global setup canlı URL'yi reddeder) ve verileri sıfırlar. Hata senaryosu için ikinci bir sunucu örneği **gerçek Resend API'sine geçersiz anahtarla** bağlanır.

## Canlıya alma (Vercel + Supabase)

### 1. Supabase
1. Proje oluşturun (bölge: Frankfurt `eu-central-1` önerilir).
2. Migration'ları uygulayın: `npx supabase link --project-ref <ref>` → `npx supabase db push` (veya `supabase/migrations/*.sql` dosyalarını sırayla SQL Editor'de çalıştırın).
3. **Authentication → Sign In / Providers**: "Allow new users to sign up" **kapalı**; Email provider **açık** kalmalı (ekip e-posta+parola ile girer).
4. **Authentication → URL Configuration**: Site URL = canlı alan adı.
5. Ekip kullanıcılarını ekleyin (`.env.local` canlı Supabase anahtarlarını içermeli):
   ```bash
   npm run staff:add -- admin@alanadiniz.com admin
   npm run staff:add -- kapi1@alanadiniz.com checkin   # yalnızca check-in ekranını görür
   ```
   Komut geçici parolayı bir kez yazar; kişiye güvenli kanaldan iletin. Alternatif: Supabase'de Authentication → Users → Add user, ardından SQL Editor'de `insert into public.staff_members (user_id, role) select id, 'admin' from auth.users where email = '…';`

### 2. Resend
1. Domain ekleyin, DNS kayıtlarını (SPF, DKIM) girin, **doğrulanmasını bekleyin**.
2. "Sending access" yetkili API anahtarı oluşturun.
3. `EMAIL_FROM` bu doğrulanmış domain'den olmalı (ör. `ASUS Workshop <workshop@alanadiniz.com>`).

### 3. Vercel
1. Repoyu içe aktarın (framework otomatik: Next.js).
2. Environment Variables (Production): `.env.example`'daki tüm değerler. `EMAIL_TEST_SINK_DIR` **eklemeyin**.
   `INVITATION_TOKEN_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`: `openssl rand -base64 48`. `INVITATION_TOKEN_SECRET` sonradan değiştirilirse gönderilmiş QR'lar geçersiz olur.
3. Deploy. `vercel.json` her gece 03:00 UTC'de `/api/cron/purge` ile saklama süresi dolan başvuruları siler.
4. Alan adı bağlayın; `NEXT_PUBLIC_SITE_URL`'i güncelleyip yeniden deploy edin (QR bağlantıları buna göre üretilir).

### 4. Canlı duman testi (yaklaşık 10 dk)
1. Kendi e-postanızla başvurun → "başvurun alındı" e-postası geldi mi?
2. Admin'den onaylayın → QR'lı davetiye geldi mi, QR görünüyor mu?
3. Telefonda `/admin/check-in` açın (https şart) → QR'ı okutun → "Giriş onaylandı"; tekrar okutun → "daha önce yapılmış".
4. Test başvurusunu Supabase'den silin, `event_settings`'i gerçek değerlerle doldurun.

## Etkinlik günü için notlar

- **Kapı ekibi**: Her kapı telefonu için ayrı `checkin` kullanıcısı açmak en sağlıklısıdır (`npm run staff:add -- kapi1@… checkin`).
- **Aynı kişi tekrar okutulursa**: Bu cihaz aynı girişi son 60 saniye içinde onayladıysa ekran mavi renkte "az önce giriş yaptı" der ve ismi gösterir (karşındaki kişi o değilse içeri alma). Daha eski bir giriş veya başka cihazda yapılmış giriş her zaman sarı "girişi daha önce yapılmış" uyarısıdır — ekran görüntüsüyle ikinci giriş denemesi böyle yakalanır.
- **İnternet kesilirse**: Ekranın üstünde kırmızı uyarı belirir. Yanıt gelmeyen istekler 8 sn'de iptal edilir; tekrar okutmak güvenlidir (çift giriş oluşmaz). Kamera çalışmazsa davetiyedeki 10 karakterlik kod elle girilir.
- **Supabase/Wi-Fi kesintisi**: Panel kullanıcıyı girişe atmaz; "Sayfa yüklenemedi → Tekrar dene" gösterir.
- **Başarısız e-postalar**: Başvurular sayfasındaki kırmızı "Başarısız e-postaları göster" bağlantısıyla listelenir; detaydan "Tekrar dene". Toplu bilgilendirmede 3 kez başarısız olan alıcı turu tıkamaz, ayrıca listelenir.

## Etkinlik öncesi akış

1. Tarih/mekân kesinleşince `/admin/ayarlar`'da girin ve "kesinleşti" kutularını işaretleyin.
2. Aynı sayfadaki **Onaylı katılımcıları bilgilendir** bölümünden güncelleme e-postasını gönderin (davetiye QR'ı dahil; kodlar değişmez).
3. Etkinlik günü kapı ekibi telefonundan `/admin/check-in` açar.

KVKK silme talebi gelirse: başvuru detayında **Başvuruyu kalıcı olarak sil** (onay için `SIL` yazılır). Saklama süresi dolan başvurular her gece otomatik silinir.

## İçeriği güncelleme

- **Metinler, görseller, biyografi, sosyal bağlantılar, ürünler, iletişim**: `src/config/event.ts`. Görselleri `public/` altına koyup `src` alanına yolunu yazın; placeholder otomatik kalkar.
  Açılış sayfasındaki görsel alanları: `hero.image` (min. 2400×1600, sol kenarı zemine erir), `approach.image` (4:3), `pillars[].image` (3 kart, 2:1), `application.image` (dikey), `artistBio.portrait` (4:5) ve `works`, ürün görselleri.
  Logolar: `logos.brand` / `logos.artist` / `logos.partner` → `public/brand/*.svg` (tanımlanmazsa düz yazı görünür).
- **Tarih, mekân, kapasite, başvuru açık/kapalı**: `/admin/ayarlar` (deploy gerektirmez). "Kesinleşti" işaretlenmedikçe sayfada ve e-postalarda gösterilmez.
- **KVKK metinleri**: `src/app/kvkk/page.tsx`, `src/app/gizlilik/page.tsx`; onaylı metni ekleyince `eventContent.legal.kvkkNoticeApproved = true` yapın ve `/admin/ayarlar`'dan sürümü artırın.

## Hukuki not

KVKK uyumu yalnızca yazılımla sağlanamaz. Aydınlatma metni, pazarlama izni metni, veri sorumlusu bilgileri, yurt dışı aktarım (Supabase/Vercel/Resend) değerlendirmesi ve saklama süresi hukuk danışmanınızdan alınmalıdır.
