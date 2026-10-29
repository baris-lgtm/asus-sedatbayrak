/**
 * Etkinliğin STATİK içerik ayarları — metinler, görseller, bağlantılar.
 *
 * Tarih, mekân, kapasite ve başvuru açık/kapalı bilgisi burada DEĞİL,
 * veritabanındaki `event_settings` tablosunda tutulur ve admin panelinden
 * güncellenir (yeniden deploy gerektirmez).
 *
 * `src: null` olan görseller sayfada sade bir yüzey olarak görünür;
 * `url: null` olan bağlantılar/düğmeler gösterilmez. Doğrulanmamış bilgi gerçekmiş gibi gösterilmez.
 */

export interface ImageSlot {
  /** public/ altındaki yol. null → sade placeholder yüzeyi gösterilir. */
  src: string | null;
  alt: string;
  /** Placeholder'da (yalnızca geliştirmede) görünen açıklama. */
  placeholderLabel: string;
}

export interface Speaker {
  name: string;
  role: string;
  /** Konuşmacılar bölümünde ikinci satır (ör. "Sohbet yürütücüsü"). */
  note?: string;
  photo: ImageSlot;
}

const photo = (name: string, file: string): ImageSlot => ({
  src: `/images/konusmaci-${file}.webp`,  // file: "sedat-v2" vb.
  alt: `${name} portresi`,
  placeholderLabel: `${name} · kare portre, min. 800×800`,
});

export const speakers = {
  sedat: { name: "Sedat Bayrak", role: "Mimar", note: "Sohbet yürütücüsü", photo: photo("Sedat Bayrak", "sedat-v2") },
  omer: { name: "Ömer Selçuk Baz", role: "Mimar", photo: photo("Ömer Selçuk Baz", "omer") },
  fatih: { name: "Fatih Çilingir", role: "3D Görselleştirme Uzmanı", photo: photo("Fatih Çilingir", "fatih-v2") },
  mesut: { name: "Mesut Çevik", role: "Teknoloji İçerik Üreticisi", note: "ProArt Sunumu", photo: photo("Mesut Çevik", "mesut-v2") },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof speakers;

export const eventContent = {
  brand: "ASUS",
  artist: "Sedat Bayrak",
  /** E-postalarda ve sayfa başlığında kullanılan etkinlik adı. */
  title: "ASUS × Sedat Bayrak Workshop",
  tagline: "Mimarlık, 3D modelleme ve yapay zekânın yaratıcı dünyasını ASUS ProArt ile keşfedeceğiniz özel bir workshop deneyimi.",
  topics: ["Mimarlık", "3D modelleme", "Yapay zekâ", "Yaratıcı üretim"],
  /** Tahmini süre bilgisi — kesin saatler event_settings'ten gelir. */
  approxDurationText: "Yaklaşık 4–5 saat",
  approxEndText: "17.00 civarı",
  /** Tarih kesinleşmeden (admin panelinde "kesinleşti" işaretlenmeden) önce gösterilen metin. */
  approxDateText: "Kasım 2026",
  cityHint: "İstanbul" as string | null,

  /** Alt marka kilidi: "ProArt | DESIGN FUTURES" */
  program: { name: "ProArt", sub: "Design Futures" },

  /** Logo dosyaları (SVG önerilir) public/brand/ altına konup yolu yazılır. null → yazı ile gösterilir. */
  logos: {
    brand: "/brand/asus-white.png" as string | null,
    program: null as string | null,
    /** Resmî ProArt yazı logosu (ProArt P16 logosundan, bakır). "ProArt | DESIGN FUTURES" kilidinde kullanılır. */
    proart: "/brand/proart-wordmark-copper.png" as string | null,
    artist: null as string | null,
    partner: null as string | null,
  },
  creativePartner: "Contra Creative" as string | null,

  /** Sosyal medya bağlantıları — url null ise simge gösterilmez. */
  socials: [
    { kind: "youtube", label: "YouTube", url: null },
    { kind: "instagram", label: "Instagram", url: null },
    { kind: "linkedin", label: "LinkedIn", url: null },
  ] as { kind: "youtube" | "instagram" | "linkedin"; label: string; url: string | null }[],

  hero: {
    title: ["Mimarlığın", "Evrimi"],
    /** public/ altındaki MP4 (H.264). null → yalnızca poster görseli gösterilir, oynatma düğmesi çıkmaz. */
    video: "/media/hero-eskizden-mimariye.mp4" as string | null,
    videoCaption: "Mimari vizyonun fikirden gerçeğe dönüşümü",
    poster: {
      src: "/images/hero-poster.webp",
      alt: "Çizgi eskizlerden gerçeğe dönüşen beton mimari yapı",
      placeholderLabel: "Hero video posteri · 16:9, min. 1920×1080",
    } satisfies ImageSlot,
  },

  about: {
    eyebrow: "Etkinlik hakkında",
    title: "Mimarlığın bugününü ve geleceğini birlikte konuşalım.",
    text: "Mimarlık, yapay zekâ ve 3D modelleme ekseninde gerçek profesyonel deneyimlere dayanan, ilham verici bir paylaşım ve bilgi buluşması. Tasarımın geleceğini şekillendiren araçlar, yöntemler ve yaklaşımlar üzerine uzman isimleri bir araya getiriyoruz.",
    image: {
      src: "/images/etkinlik-hakkinda-v2.webp",
      alt: "Eskiz çizgileriyle çevrili beton mimari yapı",
      placeholderLabel: "Etkinlik görseli · yatay, açık zemin",
    } satisfies ImageSlot,
  },

  sessions: {
    eyebrow: "Program",
    title: "Önerilen oturum temaları",
    subtitle: "Mimarlık, teknoloji ve yaratıcı üretim ekseninde üç farklı bakış açısı.",
    items: [
      {
        title: "Mimari görselleştirmede yapay zekâ",
        text: "Yapay zekâ araçları, modelleme teknikleri, agent'lar ve üretim ekosistemleri üzerine gerçek deneyimler ve güncel yaklaşımlar.",
        speakers: ["sedat", "fatih"],
        tone: "dark",
        image: { src: "/images/oturum-1-v2.webp", alt: "Gece ışıklandırmalı beton yapı", placeholderLabel: "Oturum 1 arka plan" },
      },
      {
        title: "Yaratıcı üretim için ProArt",
        text: "ASUS ProArt ekosistemiyle yaratıcı süreçlerde daha özgür, daha akıcı ve daha verimli bir üretim deneyimi.",
        speakers: ["mesut"],
        tone: "light",
        image: { src: "/images/proart-p16-white-rear.webp", alt: "ASUS ProArt P16 dizüstü bilgisayar, arkadan görünüm", placeholderLabel: "Oturum 2 · ProArt cihaz görseli" },
      },
      {
        title: "Tasarım ve mimarlık pratiği",
        text: "Strüktürel tasarım, büyük ölçekli projeler ve güncel mimarlık pratiği üzerine saha deneyimleri ve mesleki bakış açıları.",
        speakers: ["sedat", "omer"],
        tone: "dark",
        image: { src: "/images/oturum-3-v2.webp", alt: "Çizgi eskizli çok katlı yapı", placeholderLabel: "Oturum 3 arka plan" },
      },
    ] satisfies { title: string; text: string; speakers: SpeakerId[]; tone: "dark" | "light"; image: ImageSlot }[],
  },

  speakersSection: {
    eyebrow: "Konuşmacılar",
    title: "Alanında uzman isimlerle ilham verici bir buluşma.",
    text: "Mimarlık, görselleştirme, teknoloji ve yaratıcı üretim alanlarında deneyimleriyle öne çıkan uzman isimler, bilgi ve tecrübelerini paylaşıyor.",
    order: ["sedat", "omer", "fatih", "mesut"] satisfies SpeakerId[],
  },

  product: {
    eyebrow: "Ürün sunumu",
    name: "ProArt P16",
    model: "(H7607)",
    tagline: "Yaratıcı üretim ve 3D iş akışları için tasarlanan profesyonel bir deneyim.",
    text: "ProArt P16, mimarlık, 3D modelleme ve yaratıcı üretim süreçlerinde ihtiyaç duyulan esneklik ve güvenilirliği sunar. Fikirlerinizi gerçeğe dönüştürürken, hayal gücünüzün temposuna uyum sağlar.",
    /** Resmî ürün sayfası. null → "ProArt P16'yı keşfet" düğmesi gösterilmez. */
    url: null as string | null,
    ctaLabel: "ProArt P16'yı keşfet",
    /** Ürün tanıtım videosu (public/ altındaki MP4). null → video alanı gösterilmez. */
    video: null as string | null,
    image: {
      src: "/images/proart-p16-black.webp",
      alt: "ASUS ProArt P16 (H7607) Nano Black dizüstü bilgisayar",
      placeholderLabel: "Ürün görseli · yatay, min. 2000×1200",
    } satisfies ImageSlot,
  },

  application: {
    eyebrow: "Başvuru",
    title: ["Katılım için", "başvurun."],
    text: "Mimarlık, 3D modelleme ve yapay zekâ etrafında şekillenen bu özel buluşmada yer almak için aşağıdaki formu doldurun.",
    image: {
      src: "/images/basvuru-eskiz-v2.webp",
      alt: "Eskiz çizgileriyle çizilmiş mimari yapı",
      placeholderLabel: "Başvuru köşe görseli",
    } satisfies ImageSlot,
    form: {
      fullName: "Ad Soyad",
      email: "E-posta",
      phone: "Telefon",
      participantType: "Profesyonel / Öğrenci",
      institution: "Kurum / Okul",
      tools: "Kullandığınız tasarım araçları",
      toolsPlaceholder: "Ör. AutoCAD, Revit, 3ds Max, Blender…",
      portfolio: "Portfolyo bağlantısı (isteğe bağlı)",
      motivation: "Katılım motivasyonunuz",
      motivationPlaceholder: "Bu etkinliğe katılma motivasyonunuzu bizimle paylaşın…",
      note: "Başvurular ilgi alanı ve katılım motivasyonuna göre değerlendirilir. Katılım onayı e-posta ile iletilir.",
    },
  },

  /** Admin detayında ve CSV'de gösterilen ek form yanıtları (applications.additional_answers). */
  answerFields: [
    { id: "tools", label: "Kullandığı tasarım araçları" },
    { id: "portfolio", label: "Portfolyo bağlantısı" },
    { id: "motivation", label: "Katılım motivasyonu" },
  ],

  contact: {
    /** Katılımcı soruları için iletişim adresi — onaylanınca doldurulacak. */
    email: null as string | null,
  },

  legal: {
    /** Hukuk onaylı KVKK aydınlatma metni gelene kadar sayfada TASLAK uyarısı gösterilir. */
    kvkkNoticeApproved: true,
    marketingConsentApproved: false,
    dataControllerName: "ASUSTEK COMPUTER INC." as string | null,
  },
} as const;
