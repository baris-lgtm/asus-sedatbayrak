/** Veritabanı fonksiyonlarının 'ERR_*' kodlarını kullanıcı dostu Türkçe mesajlara çevirir. */
const MESSAGES: Record<string, string> = {
  ERR_FORBIDDEN: "Bu işlem için yetkin yok.",
  ERR_NOT_FOUND: "Başvuru bulunamadı.",
  ERR_INVALID_TRANSITION: "Başvurunun mevcut durumunda bu işlem yapılamaz.",
  ERR_CAPACITY_FULL: "Kapasite dolu. Başvuruyu yedek listeye alabilir veya ayarlardan kapasiteyi artırabilirsin.",
  ERR_APPLICATIONS_CLOSED: "Başvurular şu anda kapalı.",
  ERR_BAD_REQUEST: "Geçersiz istek.",
};

export function dbErrorCode(error: { message?: string } | null | undefined): string | null {
  const match = error?.message?.match(/ERR_[A-Z_]+/);
  return match ? match[0] : null;
}

export function dbErrorMessage(error: { message?: string } | null | undefined): string {
  const code = dbErrorCode(error);
  return (code && MESSAGES[code]) || "İşlem tamamlanamadı. Lütfen tekrar dene.";
}
