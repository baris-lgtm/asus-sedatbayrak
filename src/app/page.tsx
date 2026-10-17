import Link from "next/link";
import { eventContent } from "@/config/event";
import { getEventSettings } from "@/lib/event-settings";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { ImageSlot } from "@/components/image-slot";
import { ApplicationForm } from "@/components/application-form";
import { SiteFooter } from "@/components/site-footer";

// Etkinlik ayarları admin panelinden değişir; sayfa en geç 60 sn'de güncellenir
// (ayar kaydında ayrıca anında yenilenir).
export const revalidate = 60;

const TBA = "Yakında duyurulacak";

export default async function HomePage() {
  const settings = await getEventSettings();
  const date = formatEventDate(settings);
  const time = formatEventTimeRange(settings);
  const venue = settings.venue_confirmed ? settings.venue_name : null;
  const { artistBio, products } = eventContent;

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "Başvurum kabul edildi mi?",
      a: "Formu gönderdiğinde başvurun yalnızca alınmış olur; bu kabul anlamına gelmez. Her başvuru ekip tarafından tek tek değerlendirilir ve sonucu e-postayla bildirilir.",
    },
    {
      q: "Katılımım nasıl kesinleşecek?",
      a: "Katılım yalnızca ekip onayıyla kesinleşir. Onaylandığında sana QR kodlu kişisel bir davetiye e-postası gelir. Bu e-postayı almadıysan katılımın kesinleşmemiştir.",
    },
    {
      q: "Davetiyemi nasıl alacağım?",
      a: "Davetiyen, başvuruda yazdığın e-posta adresine gönderilir. Gelen kutunda göremiyorsan spam / gereksiz klasörünü de kontrol et.",
    },
    {
      q: "QR kodumu kaybedersem ne yapmalıyım?",
      a: (
        <>
          Davetiye e-postasındaki “Davetiyemi aç” bağlantısıyla QR kodunu yeniden görüntüleyebilirsin. E-postaya da
          ulaşamıyorsan bize yaz; kimliğini doğruladıktan sonra davetiyeni yeniden gönderebiliriz. Girişte e-postadaki
          10 karakterlik giriş kodu da QR yerine kullanılabilir.
        </>
      ),
    },
    {
      q: "Etkinlik saatleri nedir?",
      a: time
        ? `Workshop ${date} günü ${time} saatleri arasında gerçekleşecek.`
        : `Workshop ${eventContent.approxDurationText.toLowerCase()} sürecek ve ${eventContent.approxEndText} bitmesi planlanıyor. Kesin başlangıç saati duyurulduğunda bu sayfada ve davetiyende yer alacak.`,
    },
    {
      q: "Başvurumun durumunu nasıl öğrenebilirim?",
      a: "Başvurunla ilgili her gelişme (onay, yedek liste veya sonuç) başvuruda verdiğin e-posta adresine bildirilir. Ek sorular için iletişim adresimizden bize ulaşabilirsin.",
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/15 bg-ink text-paper">
        <nav aria-label="Ana menü" className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="condensed text-lg font-bold">
            ASUS × Sedat Bayrak
          </Link>
          <ul className="hidden items-center gap-7 text-sm md:flex">
            <li><a className="hover:underline" href="#deneyim">Deneyim</a></li>
            <li><a className="hover:underline" href="#sedat-bayrak">Sedat Bayrak</a></li>
            <li><a className="hover:underline" href="#katilim">Katılım</a></li>
            <li><a className="hover:underline" href="#sss">SSS</a></li>
          </ul>
          <a href="#basvuru" className="btn btn-on-dark min-h-10 px-4 text-sm">
            Workshop&apos;a Başvur
          </a>
        </nav>
      </header>

      <main id="icerik">
        {/* HERO — tek güçlü öğe: tam genişlikte dar kesim başlık + ölçü çizgisi */}
        <section aria-labelledby="hero-baslik" className="bg-ink text-paper">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-8 lg:grid-cols-12 lg:pb-20 lg:pt-16">
            <div className="lg:col-span-7">
              <h1 id="hero-baslik" className="display text-[clamp(4rem,15vw,11.5rem)]">
                <span className="reveal-line"><span>ASUS ×</span></span>
                <span className="reveal-line"><span>Sedat Bayrak</span></span>
                <span className="reveal-line"><span className="font-light">Workshop</span></span>
              </h1>

              <div className="mt-10 text-neutral-400" aria-hidden>
                <div className="dimension draw-in" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-6 text-sm sm:text-base">
                <div>
                  <dt className="text-neutral-400">Tarih</dt>
                  <dd className="mt-1 font-semibold">{date ?? "Ekim 2026 sonu (kesin tarih yakında)"}</dd>
                  {time && <dd className="text-neutral-300">{time}</dd>}
                </div>
                <div>
                  <dt className="text-neutral-400">Mekân</dt>
                  <dd className="mt-1 font-semibold">{venue ?? TBA}</dd>
                </div>
              </dl>

              <p className="mt-10 max-w-xl text-lg leading-relaxed text-neutral-200 sm:text-xl">{eventContent.tagline}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href="#basvuru" className="btn btn-on-dark">
                  Workshop&apos;a Başvur
                </a>
                <span className="text-sm text-neutral-400">Katılım başvuru ve ekip onayı ile</span>
              </div>
            </div>
            <ImageSlot
              slot={eventContent.hero.image}
              dark
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[4/5] w-full lg:col-span-5 lg:aspect-auto lg:min-h-[560px]"
            />
          </div>
        </section>

        {/* DENEYİM */}
        <section id="deneyim" aria-labelledby="deneyim-baslik" className="border-b border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <h2 id="deneyim-baslik" className="display text-5xl sm:text-6xl lg:col-span-4">
              Workshop deneyimi
            </h2>
            <div className="space-y-6 text-lg leading-relaxed lg:col-span-5">
              <p>
                Sanat, mimarlık ve tasarımla ilgilenen katılımcıları bir araya getiren bu atölye, fikirden üretime uzanan
                yaratıcı süreci Sedat Bayrak ile birlikte deneyimlemek için tasarlandı.
              </p>
              <p>
                Programın, dijital araçların yaratıcı üretimdeki yerini ASUS teknolojileri eşliğinde uygulamalı olarak ele
                alması planlanıyor. Program akışı ve atölye içerikleri kesinleştiğinde bu sayfada paylaşılacak.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t-2 border-ink pt-5 text-sm lg:col-span-3 lg:grid-cols-1">
              <div>
                <dt className="text-graphite">Süre</dt>
                <dd className="font-semibold">{eventContent.approxDurationText}</dd>
              </div>
              <div>
                <dt className="text-graphite">Bitiş</dt>
                <dd className="font-semibold">{time ? time.split("–")[1]?.trim() ?? eventContent.approxEndText : eventContent.approxEndText}</dd>
              </div>
              <div>
                <dt className="text-graphite">Format</dt>
                <dd className="font-semibold">Uygulamalı atölye</dd>
              </div>
              <div>
                <dt className="text-graphite">Alanlar</dt>
                <dd className="font-semibold">{eventContent.topics.join(", ")}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* SEDAT BAYRAK */}
        <section id="sedat-bayrak" aria-labelledby="sanatci-baslik" className="border-b border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <ImageSlot slot={artistBio.portrait} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[3/4] w-full lg:col-span-4" />
            <div className="lg:col-span-7 lg:col-start-6">
              <h2 id="sanatci-baslik" className="display text-5xl sm:text-6xl">
                Sedat Bayrak
              </h2>
              {artistBio.text ? (
                <p className="mt-6 max-w-2xl text-lg leading-relaxed">{artistBio.text}</p>
              ) : (
                <p className="mt-6 max-w-2xl border-l-4 border-blue pl-4 text-lg leading-relaxed text-graphite">
                  Sanatçının onaylı biyografisi yakında burada yer alacak.
                </p>
              )}
              <div className="mt-10 grid grid-cols-3 gap-3">
                {artistBio.works.map((w) => (
                  <ImageSlot key={w.alt} slot={w} sizes="(min-width: 1024px) 20vw, 33vw" className="aspect-square" />
                ))}
              </div>
              <div className="mt-6 text-sm">
                {artistBio.socials.length > 0 ? (
                  <ul className="flex flex-wrap gap-5">
                    {artistBio.socials.map((s) => (
                      <li key={s.href}>
                        <a href={s.href} rel="noopener noreferrer" target="_blank" className="font-semibold underline underline-offset-4">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-graphite">Sosyal medya bağlantıları yakında eklenecek.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ASUS ÜRÜN DENEYİMİ */}
        <section aria-labelledby="urun-baslik" className="border-b border-rule bg-mist">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="urun-baslik" className="display text-5xl sm:text-6xl lg:col-span-5">
                ASUS ile üretim
              </h2>
              <p className="max-w-2xl text-lg leading-relaxed lg:col-span-6 lg:col-start-7">
                Atölyede yaratıcı üretimi destekleyen ASUS teknolojileri deneyimlenecek. Kullanılacak ve sergilenecek ürün
                modelleri kesinleştiğinde burada tanıtılacak.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {products.confirmedModels.length > 0
                ? products.confirmedModels.map((m) => (
                    <figure key={m.name}>
                      <ImageSlot slot={m.image} sizes="(min-width: 640px) 33vw, 100vw" className="aspect-[4/3]" />
                      <figcaption className="mt-3">
                        <span className="font-semibold">{m.name}</span>
                        <span className="block text-sm text-graphite">{m.description}</span>
                      </figcaption>
                    </figure>
                  ))
                : Array.from({ length: products.placeholderSlots }, (_, i) => (
                    <ImageSlot
                      key={i}
                      slot={{ src: null, alt: `ASUS ürün görseli ${i + 1}`, placeholderLabel: "ÜRÜN GÖRSELİ — model kesinleştiğinde eklenecek" }}
                      className="aspect-[4/3]"
                    />
                  ))}
            </div>
          </div>
        </section>

        {/* KATILIM KOŞULLARI — gerçek bir sıra olduğu için numaralı */}
        <section id="katilim" aria-labelledby="katilim-baslik" className="border-b border-rule">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
            <h2 id="katilim-baslik" className="display text-5xl sm:text-6xl">
              Katılım nasıl kesinleşir
            </h2>
            <ol className="mt-12 grid gap-px border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Başvur", "Aşağıdaki formu doldur. Başvurun kaydedilir ve sana alındı e-postası gelir."],
                ["Değerlendirme", "Her başvuru ekip tarafından tek tek incelenir. Form göndermek katılımı kesinleştirmez."],
                ["Onay ve davetiye", "Onaylanan katılımcılara kişiye özel, QR kodlu davetiye e-postayla gönderilir."],
                ["Girişte okut", "Etkinlik günü QR kodunu girişte okutman yeterli. Her davetiye tek kişilik ve tek kullanımlıktır."],
              ].map(([title, body], i) => (
                <li key={title} className="bg-paper p-6">
                  <span className="display block text-6xl text-blue">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-bold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-graphite">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-3xl leading-relaxed">
              Kontenjan sınırlıdır. Kapasite dolduğunda uygun başvurular yedek listeye alınabilir; yer açılırsa yedek listedeki
              katılımcılar e-postayla bilgilendirilir.
            </p>
          </div>
        </section>

        {/* BAŞVURU FORMU */}
        <section id="basvuru" aria-labelledby="basvuru-baslik" className="scroll-mt-14 border-b border-rule bg-ink text-paper">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="basvuru-baslik" className="display text-5xl sm:text-6xl">
                Başvuru formu
              </h2>
              <p className="mt-6 max-w-sm leading-relaxed text-neutral-300">
                Formu doldurmak yaklaşık iki dakika sürer. Başvurunun sonucu e-postayla bildirilir.
              </p>
            </div>
            <div className="bg-paper p-5 text-ink sm:p-10 lg:col-span-8">
              {settings.applications_open ? (
                <ApplicationForm
                  kvkkApproved={eventContent.legal.kvkkNoticeApproved}
                  additionalQuestion={eventContent.additionalQuestion}
                  turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
                />
              ) : (
                <div role="status">
                  <h3 className="text-2xl font-bold">Başvurular şu anda kapalı</h3>
                  <p className="mt-3 leading-relaxed text-graphite">
                    Yeni başvuru alınmıyor. Gelişmeler bu sayfada duyurulacak.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* MEKÂN */}
        <section id="mekan" aria-labelledby="mekan-baslik" className="border-b border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 id="mekan-baslik" className="display text-5xl sm:text-6xl">
                Mekân ve ulaşım
              </h2>
              <dl className="mt-8 space-y-5">
                <div>
                  <dt className="text-sm text-graphite">Mekân</dt>
                  <dd className="text-lg font-semibold">{venue ?? TBA}</dd>
                </div>
                <div>
                  <dt className="text-sm text-graphite">Adres</dt>
                  <dd className="text-lg">{settings.venue_confirmed && settings.venue_address ? settings.venue_address : TBA}</dd>
                </div>
                <div>
                  <dt className="text-sm text-graphite">Ulaşım</dt>
                  <dd className="whitespace-pre-line leading-relaxed">
                    {settings.venue_confirmed && settings.transport_info
                      ? settings.transport_info
                      : "Mekân kesinleştiğinde ulaşım bilgileri burada ve davetiyende paylaşılacak."}
                  </dd>
                </div>
              </dl>
              {settings.venue_confirmed && settings.venue_map_url && (
                <a href={settings.venue_map_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-8">
                  Haritada aç
                </a>
              )}
            </div>
            <ImageSlot
              slot={{ src: null, alt: "Mekân haritası", placeholderLabel: settings.venue_confirmed ? "HARİTA — “Haritada aç” bağlantısını kullan" : "HARİTA — mekân kesinleştiğinde" }}
              className="min-h-72 lg:col-span-7"
            />
          </div>
        </section>

        {/* SSS */}
        <section id="sss" aria-labelledby="sss-baslik" className="border-b border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12">
            <h2 id="sss-baslik" className="display text-5xl sm:text-6xl lg:col-span-4">
              Sık sorulanlar
            </h2>
            <div className="border-t-2 border-ink lg:col-span-8">
              {faqs.map((f) => (
                <details key={f.q} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-2xl font-light transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="max-w-2xl pb-6 leading-relaxed text-graphite">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Başvuru çağrısı" className="bg-blue text-paper">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-8 md:flex-row md:items-center">
            <p className="display text-4xl sm:text-5xl">Yerini ayırtmak için başvur.</p>
            <a href="#basvuru" className="btn btn-on-dark">
              Workshop&apos;a Başvur
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
