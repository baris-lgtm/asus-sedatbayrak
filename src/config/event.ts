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
  tagline: "Sanat, mimarlık ve tasarımın teknolojiyle buluştuğu bir günlük üretim atölyesi.",
  topics: ["Sanat", "Mimarlık", "Tasarım", "Yaratıcı üretim"],
  /** Tahmini süre bilgisi — kesin saatler event_settings'ten gelir. */
  approxDurationText: "Yaklaşık 4–5 saat",
  approxEndText: "17.00 civarı",

  hero: {
    image: {
      src: null,
      alt: "ASUS × Sedat Bayrak Workshop ana görseli",
      placeholderLabel: "HERO GÖRSELİ — sanat × teknoloji (min. 2400×1600, onaylı görsel bekleniyor)",
    } satisfies ImageSlot,
  },

  artistBio: {
    /** Onaylı biyografi metni gelene kadar null. */
    text: null as string | null,
    portrait: {
      src: null,
      alt: "Sedat Bayrak portresi",
      placeholderLabel: "SEDAT BAYRAK PORTRE — onaylı fotoğraf bekleniyor",
    } satisfies ImageSlot,
    works: [
      { src: null, alt: "Sedat Bayrak çalışması 1", placeholderLabel: "ÇALIŞMA GÖRSELİ 1" },
      { src: null, alt: "Sedat Bayrak çalışması 2", placeholderLabel: "ÇALIŞMA GÖRSELİ 2" },
      { src: null, alt: "Sedat Bayrak çalışması 3", placeholderLabel: "ÇALIŞMA GÖRSELİ 3" },
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
