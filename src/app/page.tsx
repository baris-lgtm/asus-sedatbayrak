import { eventContent, speakers, type Speaker, type SpeakerId } from "@/config/event";
import { getEventSettings } from "@/lib/event-settings";
import { formatEventDate, formatEventDateShort, formatEventTimeRange } from "@/lib/format";
import { ImageSlot } from "@/components/image-slot";
import { ApplicationForm } from "@/components/application-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackgroundVideo, ProductVideo } from "@/components/hero-video";
import { ArrowRight, ProgramMark } from "@/components/brand";

// Etkinlik ayarları admin panelinden değişir; sayfa en geç 60 sn'de güncellenir
// (ayar kaydında ayrıca anında yenilenir).
export const revalidate = 60;

/** Görselin bir kenarını zemine eriten maskeler. */
const fade = (dir: "left" | "right", stop = "40%") => {
  const g = `linear-gradient(to ${dir === "left" ? "right" : "left"}, transparent 0%, #000 ${stop})`;
  return { WebkitMaskImage: g, maskImage: g } as const;
};

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`eyebrow-line ${light ? "!text-copper-ink" : ""}`}>{children}</p>;
}

function SpeakerCard({ s, size = "sm", light = false }: { s: Speaker; size?: "sm" | "lg"; light?: boolean }) {
  return (
    <figure className={size === "sm" ? "w-full lg:w-[8.5rem] lg:shrink-0" : ""}>
      <ImageSlot
        slot={s.photo}
        dark={!light}
        sizes={size === "sm" ? "(min-width: 1024px) 136px, 45vw" : "(min-width: 1024px) 22vw, 45vw"}
        className={`${size === "sm" ? "aspect-square" : "aspect-[5/4]"} w-full grayscale contrast-[1.06] brightness-[0.9] transition-[filter] duration-500 hover:brightness-100`}
      />
      <figcaption className="mt-3">
        <span className={`block font-medium ${size === "sm" ? "text-sm lg:text-[13px]" : "text-[15px] sm:text-base"}`}>{s.name}</span>
        <span className={`block ${size === "sm" ? "text-xs lg:text-[11px]" : "text-[13px]"} ${light ? "text-copper-ink" : "text-fog"}`}>
          {s.role}
        </span>
        {size === "lg" && s.note && <span className="block text-[13px] text-graphite">{s.note}</span>}
      </figcaption>
    </figure>
  );
}

function SpeakerNames({ ids, light = false }: { ids: readonly SpeakerId[]; light?: boolean }) {
  return (
    <p className={`mt-5 text-sm font-medium ${light ? "text-ink" : "text-copper"}`}>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && (
            <span aria-hidden className="mx-2.5 opacity-70">
              ×
            </span>
          )}
          {speakers[id].name}
        </span>
      ))}
    </p>
  );
}

export default async function HomePage() {
  const settings = await getEventSettings();
  const dateLong = formatEventDate(settings);
  const dateShort = formatEventDateShort(settings);
  const time = formatEventTimeRange(settings);
  const venue = settings.venue_confirmed ? settings.venue_name : null;
  const { hero, about, sessions, speakersSection, product, application } = eventContent;

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "Etkinlik kimler için uygun?",
      a: "Mimarlık, tasarım, 3D modelleme ve yaratıcı üretimle ilgilenen profesyoneller, akademisyenler ve öğrenciler başvurabilir. Kontenjan sınırlı olduğundan katılım, başvuruların değerlendirilmesinin ardından ekip onayıyla kesinleşir.",
    },
    {
      q: "Katılım için herhangi bir ücret var mı?",
      a: "Hayır, katılım ücretsizdir. Katılımınız yalnızca başvuru ve ekip onayıyla kesinleşir.",
    },
    {
      q: "Başvuru sonuçları ne zaman açıklanacak?",
      a: "Başvurular ekip tarafından tek tek değerlendirilir ve sonuç, başvuruda yazdığınız e-posta adresine bildirilir. Onaylanan katılımcılara QR kodlu kişisel davetiye gönderilir; bu e-postayı almadıysanız katılımınız henüz kesinleşmemiştir.",
    },
    {
      q: "Etkinlik çevrim içi mi gerçekleştirilecek?",
      a: venue
        ? `Hayır, etkinlik yüz yüze gerçekleştirilecek: ${venue}${settings.venue_address ? `, ${settings.venue_address}` : ""}. Girişte e-postayla gönderilen QR kodlu davetiyenizi okutmanız yeterli.`
        : "Hayır, etkinlik yüz yüze gerçekleştirilecek. Mekân bilgisi kesinleştiğinde bu sayfada ve davetiyenizde paylaşılacak. Girişte e-postayla gönderilen QR kodlu davetiyenizi okutmanız yeterli.",
    },
    {
      q: "Etkinlik ne zaman ve ne kadar sürecek?",
      a: dateLong
        ? `Workshop ${dateLong}${time ? `, ${time} saatleri arasında` : ""} gerçekleşecek.`
        : `Kesin tarih ve saat duyurulduğunda bu sayfada ve davetiyenizde yer alacak. Programın ${eventContent.approxDurationText.toLowerCase()} sürmesi planlanıyor.`,
    },
    {
      q: "QR kodumu kaybedersem ne yapmalıyım?",
      a: "Davetiye e-postasındaki “Davetiyemi aç” bağlantısıyla QR kodunuzu yeniden görüntüleyebilirsiniz. Girişte e-postadaki 10 karakterlik giriş kodu da QR yerine kullanılabilir.",
    },
  ];

  return (
    <div className="bg-night font-headline text-white">
      <SiteHeader />

      <main id="icerik">
        {/* HERO */}
        <section aria-labelledby="hero-baslik" className="relative overflow-hidden lg:min-h-[640px]">
          {/* Video tüm ekranlarda bölümün arka planı */}
          <div className="absolute inset-0">
            <BackgroundVideo
              src={hero.video}
              poster={hero.poster}
              caption={hero.videoCaption}
              sizes="100vw"
              className="h-full w-full"
            />
            {/* Masaüstü: soldan; mobil/tablet: alttan karartma (metin okunurluğu) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,#0d0c0b_0%,rgba(13,12,11,0.92)_28%,rgba(13,12,11,0.35)_52%,transparent_70%)] lg:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(13,12,11,0.55)_0%,rgba(13,12,11,0.05)_22%,rgba(13,12,11,0.35)_45%,rgba(13,12,11,0.9)_68%,#0d0c0b_100%)] lg:hidden"
            />
          </div>
          <div className="pointer-events-none relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-end px-5 pb-10 pt-24 sm:min-h-[min(calc(100svh-4rem),58rem)] sm:px-8 sm:pb-14 lg:block lg:min-h-0 lg:pb-28 lg:pt-16">
            <div className="pointer-events-auto max-w-md sm:max-w-lg lg:max-w-md">
              <ProgramMark className="rise text-[16px] sm:text-[18px] lg:text-[17px]" />
              <div aria-hidden className="mt-6 h-px w-full max-w-[22rem] bg-white/25 lg:mt-7" />
              <h1 id="hero-baslik" className="headline rise rise-1 mt-6 text-[clamp(3.1rem,12vw,5.4rem)] leading-[0.98] lg:mt-8 lg:text-[clamp(3.2rem,7vw,5.4rem)]">
                <span className="block">{hero.title[0]}</span>
                <span className="block text-copper">{hero.title[1]}</span>
              </h1>
              <p className="rise rise-2 mt-5 max-w-sm text-[15px] leading-relaxed text-white/85 sm:text-base lg:mt-7 lg:text-[15px]">{eventContent.tagline}</p>
              <div aria-hidden className="mt-7 h-px w-full max-w-[22rem] bg-white/25 lg:mt-9" />

              <div className="rise rise-3 mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 lg:mt-7 lg:block">
                <div>
                  <p className="text-2xl font-medium sm:text-[1.75rem]">{dateShort ?? eventContent.approxDateText}</p>
                  <p className="mt-1.5 text-[13px] text-white/70">
                    {[time, venue ?? eventContent.cityHint].filter(Boolean).join(" · ")}
                    {!dateShort && " · Kesin tarih yakında açıklanacak"}
                  </p>
                </div>
                <a href="#basvuru" className="btn-ghost-light arrow-nudge w-full sm:w-auto lg:mt-8">
                  Katılım için başvur
                  <ArrowRight />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ETKİNLİK HAKKINDA */}
        <section id="etkinlik" aria-labelledby="etkinlik-baslik" className="relative scroll-mt-16 overflow-hidden bg-cream text-ink">
          <div className="absolute inset-y-0 right-0 hidden w-[52%] lg:block" style={fade("left", "45%")}>
            <ImageSlot slot={about.image} rounded={false} labelRight sizes="52vw" className="h-full w-full" />
          </div>
          <div className="relative lg:hidden">
            <ImageSlot slot={about.image} rounded={false} sizes="100vw" className="aspect-[4/3] w-full sm:aspect-[16/9]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cream to-transparent" />
          </div>
          <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 lg:py-24">
            <div className="max-w-[34rem] sm:max-w-xl lg:max-w-[34rem]">
              <Eyebrow light>{about.eyebrow}</Eyebrow>
              <h2 id="etkinlik-baslik" className="headline mt-6 text-[clamp(2.1rem,3.8vw,3rem)]">
                {about.title}
              </h2>
              <p className="mt-6 text-[15px] leading-[1.7] text-graphite">{about.text}</p>
            </div>
          </div>
        </section>

        {/* PROGRAM */}
        <section id="program" aria-labelledby="program-baslik" className="scroll-mt-16">
          <div className="mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8 sm:pt-20 lg:pt-24">
            <Eyebrow>{sessions.eyebrow}</Eyebrow>
            <h2 id="program-baslik" className="headline mt-6 text-[clamp(2.1rem,3.8vw,3rem)]">
              {sessions.title}
            </h2>
            <p className="mt-3 text-[15px] text-white/70">{sessions.subtitle}</p>
          </div>

          <ol>
            {sessions.items.map((item, i) => {
              const light = item.tone === "light";
              const n = String(i + 1).padStart(2, "0");
              return (
                <li
                  key={item.title}
                  className={`relative overflow-hidden ${light ? "bg-cream text-ink" : "border-t border-white/10 bg-night-2"}`}
                >
                  <div
                    className={`absolute inset-y-0 hidden lg:block ${light ? "left-0 w-[34%] py-8 pl-[3vw] pr-6" : "right-0 w-[26%] xl:w-[34%]"}`}
                    style={light ? undefined : fade("left", "50%")}
                  >
                    <ImageSlot
                      slot={item.image}
                      dark={!light}
                      rounded={false}
                      labelRight={!light}
                      fit={light ? "contain" : "cover"}
                      sizes="34vw"
                      className="h-full w-full"
                    />
                  </div>
                  {/* Mobil/tablet: oturum görseli üstte bant olarak */}
                  <div className={`relative lg:hidden ${light ? "px-8 pt-8 sm:px-24 md:px-36" : ""}`}>
                    <ImageSlot
                      slot={item.image}
                      dark={!light}
                      rounded={false}
                      fit={light ? "contain" : "cover"}
                      sizes="100vw"
                      className={light ? "aspect-[16/8] w-full" : "aspect-[16/9] w-full sm:aspect-[21/9]"}
                    />
                    {!light && (
                      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-2 via-night-2/40 to-transparent" />
                    )}
                  </div>
                  <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-12 pt-2 sm:px-8 sm:pb-14 md:grid-cols-12 md:items-center md:gap-6 lg:py-16">
                    <div className={`flex gap-5 sm:gap-7 md:col-span-7 lg:gap-9 ${light ? "lg:col-span-5 lg:col-start-5" : "lg:col-span-6"}`}>
                      <span
                        aria-hidden
                        className={`headline w-[3.4rem] shrink-0 text-[clamp(3.2rem,5.4vw,4.6rem)] sm:w-[5.5rem] font-extralight leading-none ${light ? "text-copper-ink" : "text-copper"}`}
                      >
                        {n}
                      </span>
                      <div className="pt-2">
                        <h3 className="headline text-[1.6rem] sm:text-[1.85rem]">
                          <span className="sr-only">Oturum {i + 1}: </span>
                          {item.title}
                        </h3>
                        <p className={`mt-3 max-w-md text-[15px] leading-relaxed ${light ? "text-graphite" : "text-white/70"}`}>
                          {item.text}
                        </p>
                        <SpeakerNames ids={item.speakers} light={light} />
                      </div>
                    </div>
                    <div
                      className={`grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4 md:col-span-5 md:max-w-none lg:flex ${
                        light ? "lg:col-span-3 lg:col-start-10 lg:justify-end" : "lg:col-span-4"
                      }`}
                    >
                      {item.speakers.map((id) => (
                        <SpeakerCard key={id} s={speakers[id]} light={light} />
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* KONUŞMACILAR */}
        <section id="konusmacilar" aria-labelledby="konusmaci-baslik" className="scroll-mt-16 bg-cream text-ink">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-6">
                <Eyebrow light>{speakersSection.eyebrow}</Eyebrow>
                <h2 id="konusmaci-baslik" className="headline mt-6 text-[clamp(2.1rem,3.8vw,3rem)]">
                  {speakersSection.title}
                </h2>
              </div>
              <p className="max-w-md text-[15px] leading-[1.7] text-graphite lg:col-span-5 lg:col-start-8">
                {speakersSection.text}
              </p>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-12 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 md:gap-x-4">
              {speakersSection.order.map((id) => (
                <li key={id}>
                  <SpeakerCard s={speakers[id]} size="lg" light />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ÜRÜN */}
        <section id="proart" aria-labelledby="urun-baslik" className="relative scroll-mt-16 overflow-hidden border-t border-ink/10 bg-cream text-ink">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-12 md:gap-8 lg:py-28">
            <div className="md:col-span-5 lg:col-span-4">
              <Eyebrow light>{product.eyebrow}</Eyebrow>
              <h2 id="urun-baslik" className="headline mt-6 text-[clamp(2.3rem,4.2vw,3.3rem)]">
                {product.name} <span className="whitespace-nowrap">{product.model}</span>
              </h2>
              <p className="mt-4 text-lg leading-snug">{product.tagline}</p>
              <p className="mt-5 text-[15px] leading-[1.7] text-graphite">{product.text}</p>
              {product.url && (
                <a href={product.url} target="_blank" rel="noopener noreferrer" className="btn-copper arrow-nudge mt-8">
                  {product.ctaLabel}
                  <ArrowRight />
                </a>
              )}
            </div>
            <div className="order-first md:order-none md:col-span-7 lg:col-span-8">
              {product.video ? (
                <ProductVideo
                  src={product.video}
                  poster={product.videoPoster}
                  label={`${product.name} ${product.model} tanıtım videosu`}
                  className="aspect-video w-full rounded-[4px] shadow-[0_40px_80px_-40px_rgba(23,18,12,0.55)]"
                />
              ) : (
                <ImageSlot slot={product.image} rounded={false} fit="contain" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[16/11] w-full" />
              )}
            </div>
          </div>
        </section>

        {/* BAŞVURU */}
        <section id="basvuru" aria-labelledby="basvuru-baslik" className="relative scroll-mt-16 overflow-hidden">
          <div className="absolute bottom-0 left-0 hidden h-[45%] w-[34%] lg:block" style={fade("right", "60%")}>
            <ImageSlot slot={application.image} dark rounded={false} sizes="34vw" className="h-full w-full opacity-70" />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:gap-12 sm:px-8 sm:py-20 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-4">
              <Eyebrow>{application.eyebrow}</Eyebrow>
              <h2 id="basvuru-baslik" className="headline mt-6 text-[clamp(2.4rem,4.2vw,3.3rem)]">
                {application.title[0]}
                <br />
                {application.title[1]}
              </h2>
              <p className="mt-6 max-w-xs text-[15px] leading-[1.7] text-white/70 sm:max-w-md lg:max-w-xs">{application.text}</p>
            </div>
            <div className="lg:col-span-8">
              {settings.applications_open ? (
                <ApplicationForm
                  kvkkApproved={eventContent.legal.kvkkNoticeApproved}
                  copy={application.form}
                  turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
                />
              ) : (
                <div role="status" className="rounded-[4px] border border-white/12 bg-white/[0.03] p-8">
                  <h3 className="headline text-3xl">Başvurular şu anda kapalı</h3>
                  <p className="mt-3 leading-relaxed text-fog">Yeni başvuru alınmıyor. Gelişmeler bu sayfada duyurulacak.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SSS */}
        <section id="sss" aria-labelledby="sss-baslik" className="scroll-mt-16 bg-cream text-ink">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:gap-10 sm:px-8 sm:py-20 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-4">
              <Eyebrow light>Sık sorulan sorular</Eyebrow>
              <h2 id="sss-baslik" className="headline mt-6 text-[clamp(2.4rem,4.2vw,3.3rem)]">
                Merak
                <br />
                edilenler.
              </h2>
            </div>
            <div className="divide-y divide-ink/12 border-y border-ink/12 lg:col-span-7 lg:col-start-6">
              {faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[15px] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-xl font-light leading-none transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="max-w-2xl pb-5 text-sm leading-relaxed text-graphite">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
