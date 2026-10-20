import { eventContent } from "@/config/event";
import { getEventSettings } from "@/lib/event-settings";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { ImageSlot } from "@/components/image-slot";
import { ApplicationForm } from "@/components/application-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArrowRight, CalendarIcon, PinIcon } from "@/components/brand";

// Etkinlik ayarları admin panelinden değişir; sayfa en geç 60 sn'de güncellenir
// (ayar kaydında ayrıca anında yenilenir).
export const revalidate = 60;

const TBA = "Yakında duyurulacak";

/** Görselin sol kenarını zemine eriten maske (hero ve başvuru görseli). */
const fadeLeft = {
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 38%)",
  maskImage: "linear-gradient(to right, transparent 0%, #000 38%)",
} as const;

function Eyebrow({ children, as: Tag = "p", id }: { children: React.ReactNode; as?: "p" | "h2"; id?: string }) {
  return (
    <Tag id={id} className="eyebrow">
      {children}
    </Tag>
  );
}

export default async function HomePage() {
  const settings = await getEventSettings();
  const date = formatEventDate(settings);
  const time = formatEventTimeRange(settings);
  const venue = settings.venue_confirmed ? settings.venue_name : null;
  const { artistBio, products, approach, pillars, hero } = eventContent;

  const heroDate = date ?? eventContent.approxDateText;
  const heroPlace = venue ?? eventContent.cityHint;
  const pendingNote =
    !date && !venue
      ? "Kesin tarih ve mekân yakında açıklanacak."
      : !date
        ? "Kesin tarih yakında açıklanacak."
        : !venue
          ? "Kesin mekân yakında açıklanacak."
          : time;

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "Etkinliğe kimler katılabilir?",
      a: `Sanat, mimarlık ve tasarımla ilgilenen öğrenciler, akademisyenler ve profesyoneller başvurabilir. Kontenjan sınırlı olduğu için katılım, başvuruların değerlendirilmesinin ardından ekip onayıyla kesinleşir.`,
    },
    {
      q: "Başvurum kabul edildi mi?",
      a: "Formu gönderdiğinde başvurun yalnızca alınmış olur; bu kabul anlamına gelmez. Her başvuru ekip tarafından tek tek değerlendirilir ve sonucu e-postayla bildirilir.",
    },
    {
      q: "Katılım onayı nasıl iletilir?",
      a: "Katılım yalnızca ekip onayıyla kesinleşir. Onaylandığında sana QR kodlu kişisel bir davetiye e-postası gelir. Bu e-postayı almadıysan katılımın kesinleşmemiştir. Gelen kutunda göremiyorsan spam / gereksiz klasörünü de kontrol et.",
    },
    {
      q: "Tarih ve mekân ne zaman açıklanacak?",
      a: date
        ? `Workshop ${date}${time ? `, ${time} saatleri arasında` : ""}${venue ? ` ${venue} mekânında` : ""} gerçekleşecek.`
        : `Kesin tarih ve mekân belirlendiğinde bu sayfada duyurulacak ve onaylı katılımcılara e-postayla bildirilecek. Workshop'un ${eventContent.approxDurationText.toLowerCase()} sürmesi planlanıyor.`,
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
      q: "Başvurumun durumunu nasıl öğrenebilirim?",
      a: "Başvurunla ilgili her gelişme (onay, yedek liste veya sonuç) başvuruda verdiğin e-posta adresine bildirilir.",
    },
  ];

  return (
    <>
      <SiteHeader />

      <main id="icerik">
        {/* HERO */}
        <section aria-labelledby="hero-baslik" className="relative overflow-hidden">
          <div
            className="fade-in pointer-events-none absolute inset-y-0 right-0 hidden w-[64%] lg:block"
            style={fadeLeft}
          >
            <ImageSlot
              slot={hero.image}
              priority
              rounded={false}
              labelRight
              sizes="64vw"
              className="h-full w-full"
            />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-8 lg:min-h-[640px] lg:pb-28 lg:pt-24">
            <div className="max-w-xl">
              <Eyebrow>ASUS × Sedat Bayrak Workshop</Eyebrow>
              <h1 id="hero-baslik" className="display rise rise-1 mt-6 text-[clamp(2.7rem,7.4vw,5.9rem)] lg:-mr-48">
                {hero.title.map((line) => (
                  <span key={line} className="block sm:whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="rise rise-2 mt-6 max-w-md text-lg leading-relaxed text-graphite sm:text-xl">
                {eventContent.tagline}
              </p>

              <div className="rise rise-3 mt-9 flex items-start gap-3">
                <CalendarIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink/70" />
                <div>
                  <p className="text-[15px] font-medium">
                    {heroDate}
                    {heroPlace && (
                      <>
                        <span aria-hidden className="mx-2 text-graphite">
                          •
                        </span>
                        {heroPlace}
                      </>
                    )}
                  </p>
                  {pendingNote && <p className="mt-1 text-[13px] text-graphite">{pendingNote}</p>}
                </div>
              </div>

              <div className="rise rise-3 mt-9 flex flex-wrap items-center gap-5">
                <a href="#basvuru" className="btn btn-primary arrow-nudge">
                  Katılım için başvur
                  <ArrowRight />
                </a>
                <span className="text-[13px] text-graphite">Kontenjan sınırlı · ekip onayıyla</span>
              </div>
            </div>
          </div>
          <ImageSlot slot={hero.image} sizes="100vw" rounded={false} className="aspect-[4/3] w-full lg:hidden" />
        </section>

        {/* YAKLAŞIM */}
        <section id="yaklasim" aria-labelledby="yaklasim-baslik" className="scroll-mt-16">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-28">
            <ImageSlot
              slot={approach.image}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="aspect-[4/3] w-full lg:col-span-6"
            />
            <div className="lg:col-span-6">
              <Eyebrow>{approach.eyebrow}</Eyebrow>
              <h2 id="yaklasim-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
                {approach.title}
              </h2>
              <div className="mt-7 max-w-lg space-y-5 text-[15px] leading-[1.75] text-graphite">
                {approach.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* DENEYİMİN ÜÇ BOYUTU */}
        <section aria-labelledby="boyut-baslik">
          <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-8 lg:pb-28">
            <Eyebrow as="h2" id="boyut-baslik">
              Deneyimin üç boyutu
            </Eyebrow>
            <ul className="mt-6 grid gap-4 md:grid-cols-3 md:gap-5">
              {pillars.map((p) => (
                <li key={p.title}>
                  <a
                    href={p.href}
                    className="arrow-nudge group flex h-full flex-col overflow-hidden rounded-[3px] border border-rule bg-surface transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(23,22,20,0.35)]"
                  >
                    <ImageSlot slot={p.image} rounded={false} sizes="(min-width: 768px) 30vw, 100vw" className="aspect-[2/1] w-full" />
                    <span className="flex flex-1 flex-col p-6">
                      <span className="display text-[1.65rem]">{p.title}</span>
                      <span className="mt-3 flex-1 text-sm leading-relaxed text-graphite">{p.text}</span>
                      <ArrowRight className="mt-6 h-4 w-4 text-ink" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SEDAT BAYRAK */}
        <section id="sedat-bayrak" aria-labelledby="sanatci-baslik" className="scroll-mt-16 border-t border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-28">
            <div className="lg:col-span-6 lg:pt-6">
              <Eyebrow>Sanatçı</Eyebrow>
              <h2 id="sanatci-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
                Sedat Bayrak
              </h2>
              {artistBio.text ? (
                <p className="mt-7 max-w-lg text-[15px] leading-[1.75] text-graphite">{artistBio.text}</p>
              ) : (
                <p className="mt-7 max-w-lg text-[15px] leading-[1.75] text-graphite">
                  Sanatçının onaylı biyografisi yakında burada yer alacak.
                </p>
              )}
              <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                {artistBio.works.map((w) => (
                  <ImageSlot key={w.alt} slot={w} sizes="(min-width: 1024px) 14vw, 30vw" className="aspect-square" />
                ))}
              </div>
              {artistBio.socials.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-6 text-sm">
                  {artistBio.socials.map((s) => (
                    <li key={s.href}>
                      <a href={s.href} rel="noopener noreferrer" target="_blank" className="arrow-nudge inline-flex items-center gap-2 font-medium">
                        {s.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ImageSlot
              slot={artistBio.portrait}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="order-first aspect-[4/5] w-full lg:order-none lg:col-span-5 lg:col-start-8"
            />
          </div>
        </section>

        {/* ASUS ÜRÜN DENEYİMİ */}
        <section id="urun" aria-labelledby="urun-baslik" className="scroll-mt-16 bg-mist">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-6">
                <Eyebrow>Ürün deneyimi</Eyebrow>
                <h2 id="urun-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
                  ASUS ile üretim
                </h2>
              </div>
              <p className="max-w-md text-[15px] leading-[1.75] text-graphite lg:col-span-5 lg:col-start-8">
                Atölyede yaratıcı üretimi destekleyen ASUS teknolojileri deneyimlenecek. Kullanılacak ürün modelleri
                kesinleştiğinde burada tanıtılacak.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {products.confirmedModels.length > 0
                ? products.confirmedModels.map((m) => (
                    <figure key={m.name}>
                      <ImageSlot slot={m.image} sizes="(min-width: 640px) 30vw, 100vw" className="aspect-[4/3]" />
                      <figcaption className="mt-4">
                        <span className="display block text-xl">{m.name}</span>
                        <span className="mt-1 block text-sm text-graphite">{m.description}</span>
                      </figcaption>
                    </figure>
                  ))
                : Array.from({ length: products.placeholderSlots }, (_, i) => (
                    <ImageSlot
                      key={i}
                      slot={{ src: null, alt: `ASUS ürün görseli ${i + 1}`, placeholderLabel: "Ürün görseli · model kesinleşince" }}
                      className="aspect-[4/3]"
                    />
                  ))}
            </div>
          </div>
        </section>

        {/* KATILIM SÜRECİ — gerçek bir sıra olduğu için numaralı */}
        <section id="surec" aria-labelledby="surec-baslik" className="scroll-mt-16">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
            <Eyebrow>Süreç</Eyebrow>
            <h2 id="surec-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
              Katılım nasıl kesinleşir
            </h2>
            <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Başvur", "Formu doldur. Başvurun kaydedilir ve sana alındı e-postası gelir."],
                ["Değerlendirme", "Her başvuru ekip tarafından tek tek incelenir. Form göndermek katılımı kesinleştirmez."],
                ["Onay ve davetiye", "Onaylanan katılımcılara kişiye özel, QR kodlu davetiye e-postayla gönderilir."],
                ["Girişte okut", "Etkinlik günü QR kodunu girişte okutman yeterli. Her davetiye tek kişilik ve tek kullanımlıktır."],
              ].map(([title, body], i) => (
                <li key={title} className="border-t border-ink/80 pt-5">
                  <span className="display block text-lg text-blue">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-2xl text-sm leading-relaxed text-graphite">
              Kontenjan sınırlıdır. Kapasite dolduğunda uygun başvurular yedek listeye alınabilir; yer açılırsa yedek
              listedeki katılımcılar e-postayla bilgilendirilir.
            </p>
          </div>
        </section>

        {/* BAŞVURU FORMU */}
        <section id="basvuru" aria-labelledby="basvuru-baslik" className="relative scroll-mt-16 overflow-hidden border-y border-rule bg-[#f3f0ea]">
          <div className="absolute inset-y-0 right-0 hidden w-[24%] xl:block" style={fadeLeft}>
            <ImageSlot slot={eventContent.application.image} rounded={false} labelRight sizes="24vw" className="h-full w-full" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-4 xl:col-span-4">
              <Eyebrow>Başvuru</Eyebrow>
              <h2 id="basvuru-baslik" className="display mt-5 text-[clamp(2.5rem,4.2vw,3.5rem)]">
                Yerini ayır,
                <br />
                yaratıcılığa katıl.
              </h2>
              <p className="mt-6 max-w-sm text-[15px] leading-[1.75] text-graphite">
                Kontenjanla sınırlı olan bu özel deneyimin bir parçası olmak için başvur. Başvurular değerlendirilerek
                katılım onayı e-posta ile iletilecek.
              </p>
              <p className="mt-6 text-[13px] text-graphite">Formu doldurmak yaklaşık iki dakika sürer.</p>
            </div>
            <div className="lg:col-span-8 xl:col-span-5">
              {settings.applications_open ? (
                <ApplicationForm
                  kvkkApproved={eventContent.legal.kvkkNoticeApproved}
                  additionalQuestion={eventContent.additionalQuestion}
                  turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
                />
              ) : (
                <div role="status" className="rounded-[3px] border border-rule bg-surface p-8">
                  <h3 className="display text-3xl">Başvurular şu anda kapalı</h3>
                  <p className="mt-3 leading-relaxed text-graphite">Yeni başvuru alınmıyor. Gelişmeler bu sayfada duyurulacak.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* MEKÂN VE ULAŞIM */}
        <section id="mekan" aria-labelledby="mekan-baslik" className="scroll-mt-16">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-4">
              <Eyebrow>Etkinlik</Eyebrow>
              <h2 id="mekan-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
                Mekân ve ulaşım
              </h2>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-[3px] border border-rule bg-rule sm:grid-cols-2 lg:col-span-8">
              <div className="bg-surface p-6">
                <dt className="flex items-center gap-2 text-[13px] text-graphite">
                  <CalendarIcon className="h-4 w-4" /> Tarih
                </dt>
                <dd className="mt-2 font-medium">{date ?? `${eventContent.approxDateText} · kesin tarih yakında`}</dd>
                {time && <dd className="text-sm text-graphite">{time}</dd>}
              </div>
              <div className="bg-surface p-6">
                <dt className="text-[13px] text-graphite">Süre ve format</dt>
                <dd className="mt-2 font-medium">{eventContent.approxDurationText}</dd>
                <dd className="text-sm text-graphite">Uygulamalı atölye</dd>
              </div>
              <div className="bg-surface p-6">
                <dt className="flex items-center gap-2 text-[13px] text-graphite">
                  <PinIcon className="h-4 w-4" /> Mekân
                </dt>
                <dd className="mt-2 font-medium">{venue ?? TBA}</dd>
                <dd className="text-sm text-graphite">
                  {settings.venue_confirmed && settings.venue_address ? settings.venue_address : eventContent.cityHint ?? ""}
                </dd>
                {settings.venue_confirmed && settings.venue_map_url && (
                  <dd className="mt-4">
                    <a href={settings.venue_map_url} target="_blank" rel="noopener noreferrer" className="arrow-nudge inline-flex items-center gap-2 text-sm font-medium text-blue">
                      Haritada aç <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </dd>
                )}
              </div>
              <div className="bg-surface p-6">
                <dt className="text-[13px] text-graphite">Ulaşım</dt>
                <dd className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                  {settings.venue_confirmed && settings.transport_info
                    ? settings.transport_info
                    : "Mekân kesinleştiğinde ulaşım bilgileri burada ve davetiyende paylaşılacak."}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* SSS */}
        <section id="sss" aria-labelledby="sss-baslik" className="scroll-mt-16 border-t border-rule">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
            <div className="lg:col-span-5">
              <Eyebrow>Sıkça sorulan sorular</Eyebrow>
              <h2 id="sss-baslik" className="display mt-5 text-[clamp(2.4rem,4.6vw,3.6rem)]">
                Merak edilenler.
              </h2>
            </div>
            <div className="divide-y divide-rule overflow-hidden rounded-[3px] border border-rule bg-surface lg:col-span-7">
              {faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 text-[15px] font-medium transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-xl font-light leading-none text-ink/70 transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="max-w-2xl px-5 pb-5 text-sm leading-relaxed text-graphite">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* SON ÇAĞRI */}
        <section aria-label="Başvuru çağrısı" className="bg-ink text-paper">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-16 sm:px-8 md:flex-row md:items-center">
            <p className="display text-[clamp(2.2rem,4.2vw,3.4rem)]">Yerini ayırmak için başvur.</p>
            <a href="#basvuru" className="btn btn-on-dark arrow-nudge">
              Katılım için başvur
              <ArrowRight />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
