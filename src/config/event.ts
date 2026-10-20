/**
 * Etkinliğin STATİK içerik ayarları — metinler, görseller, bağlantılar.
 *
 * Tarih, mekân, kapasite ve başvuru açık/kapalı bilgisi burada DEĞİL,
 * veritabanındaki `event_settings` tablosunda tutulur ve admin panelinden
 * güncellenir (yeniden deploy gerektirmez).
 *
 * `null` veya `placeholder: true` olan alanlar sayfada açıkça
 * "Yakında duyurulacak" / görsel placeholder olarak gösterilir.
 * Doğrulanmamış bilgi gerçekmiş gibi gösterilmez.
 */

export interface ImageSlot {
  /** public/ altındaki yol. null → etiketli placeholder kutusu gösterilir. */
  src: string | null;
  alt: string;
  /** Placeholder'da görünen açıklama (hangi görselin gelmesi gerektiği). */
  placeholderLabel: string;
}

export const eventContent = {
  brand: "ASUS",
  artist: "Sedat Bayrak",
  title: "ASUS × Sedat Bayrak Workshop",
  tagline: "Mimarlık, tasarım ve teknoloji aynı deneyimde buluşuyor.",
  topics: ["Sanat", "Mimarlık", "Tasarım", "Yaratıcı üretim"],
  /** Tahmini süre bilgisi — kesin saatler event_settings'ten gelir. */
  approxDurationText: "Yaklaşık 4–5 saat",
  approxEndText: "17.00 civarı",
  /** Tarih kesinleşmeden önce gösterilen yaklaşık dönem ve şehir. Kesin bilgi event_settings'ten gelir. */
  approxDateText: "Ekim 2026 sonu",
  cityHint: "İstanbul" as string | null,

  /** Logo dosyaları (SVG önerilir) public/brand/ altına konup yolu yazılır. null → yazı ile gösterilir. */
  logos: {
    brand: null as string | null,
    artist: null as string | null,
    partner: null as string | null,
  },
  creativePartner: "Contra Creative" as string | null,

  hero: {
    title: ["Yaratıcılığın", "yeni perspektifi"],
    image: {
      src: null,
      alt: "Mimari maketler ve ASUS dizüstü bilgisayarın bulunduğu çalışma masası",
      placeholderLabel: "Hero görseli · min. 2400×1600",
    } satisfies ImageSlot,
  },

  approach: {
    eyebrow: "Yaklaşım",
    title: "Tasarımın arkasındaki düşünce",
    paragraphs: [
      "ASUS × Sedat Bayrak workshop'unda, mimarlık, tasarım ve yaratıcı üretim ekseninde ilham verici bir deneyim seni bekliyor. Fikirden mekâna, eskizden dijital üretime uzanan süreçte, teknolojinin yaratıcı düşünceyi nasıl destekleyebileceğini birlikte keşfedeceğiz.",
      "Disiplinler arası bakış açılarıyla, tasarımın arkasındaki düşünceyi daha yakından deneyimlemek ve kendi üretim pratiğine yeni perspektifler katmak için buluşuyoruz.",
    ],
    image: {
      src: null,
      alt: "Masa üzerinde mimari maket ve eskizler",
      placeholderLabel: "Yaklaşım görseli · 4:3",
    } satisfies ImageSlot,
  },

  /** "Deneyimin üç boyutu" kartları. href sayfadaki ilgili bölüme gider. */
  pillars: [
    {
      title: "İlham al",
      text: "Mimarlık ve tasarımın kesişiminde farklı bakış açılarıyla ilham verici bir ortam deneyimle.",
      href: "#sedat-bayrak",
      image: { src: null, alt: "Eskizler ve maket parçaları", placeholderLabel: "Kart görseli 1" },
    },
    {
      title: "Üretimi keşfet",
      text: "Eskizden modele, fikirden mekâna uzanan yaratıcı üretim süreçlerini daha yakından gör.",
      href: "#surec",
      image: { src: null, alt: "Maket üzerinde çalışan eller", placeholderLabel: "Kart görseli 2" },
    },
    {
      title: "ASUS'u deneyimle",
      text: "Yaratıcı projelerde teknolojinin sunduğu imkânları gerçek kullanım senaryolarıyla keşfet.",
      href: "#urun",
      image: { src: null, alt: "Stüdyoda ASUS dizüstü bilgisayar", placeholderLabel: "Kart görseli 3" },
    },
  ] satisfies { title: string; text: string; href: string; image: ImageSlot }[],

  application: {
    image: {
      src: null,
      alt: "Taş sütunlar arasından İstanbul manzarası",
      placeholderLabel: "Başvuru görseli · dikey 3:4",
    } satisfies ImageSlot,
  },

  artistBio: {
    /** Onaylı biyografi metni gelene kadar null. */
    text: null as string | null,
    portrait: {
      src: null,
      alt: "Sedat Bayrak portresi",
      placeholderLabel: "Portre · onaylı fotoğraf bekleniyor",
    } satisfies ImageSlot,
    works: [
      { src: null, alt: "Sedat Bayrak çalışması 1", placeholderLabel: "Çalışma 1" },
      { src: null, alt: "Sedat Bayrak çalışması 2", placeholderLabel: "Çalışma 2" },
      { src: null, alt: "Sedat Bayrak çalışması 3", placeholderLabel: "Çalışma 3" },
    ] satisfies ImageSlot[],
    /** Doğrulanmış bağlantılar. Boş dizi → "Bağlantılar yakında" gösterilir. */
    socials: [] as { label: string; href: string }[],
  },

  products: {
    /** Kesinleşmiş ürün modelleri. Boşken genel placeholder gösterilir. */
    confirmedModels: [] as { name: string; description: string; image: ImageSlot }[],
    placeholderSlots: 3,
  },

  contact: {
    /** Katılımcı soruları için iletişim adresi — onaylanınca doldurulacak. */
    email: null as string | null,
  },

  legal: {
    /** Hukuk onaylı KVKK aydınlatma metni gelene kadar sayfada TASLAK uyarısı gösterilir. */
    kvkkNoticeApproved: false,
    marketingConsentApproved: false,
    dataControllerName: null as string | null,
  },

  /** Formdaki opsiyonel ek soru. null → gösterilmez. */
  additionalQuestion: {
    id: "motivation",
    label: "Workshop'a neden katılmak istiyorsun? (isteğe bağlı)",
    maxLength: 600,
  } as { id: string; label: string; maxLength: number } | null,
} as const;
