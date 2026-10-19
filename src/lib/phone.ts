/**
 * Telefon numarasını DB'nin kabul ettiği biçime (+ ve 10-15 rakam) normalize eder.
 * Türkiye numaraları için yaygın girişler desteklenir:
 *   0555 111 22 33 | 555 111 22 33 | +90 555 111 22 33 | 0090 555... → +905551112233
 * Diğer ülkeler + ile başlamalıdır. Geçersizse null döner.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!hasPlus) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("05")) {
      digits = "90" + digits.slice(1);
    } else if (digits.length === 10 && digits.startsWith("5")) {
      digits = "90" + digits;
    } else {
      return null;
    }
  }

  if (digits.startsWith("90") && digits.length !== 12) return null;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Görüntüleme/CSV için: +905551112233 → "0555 111 22 33" (TR); diğerleri "0044 2079460958".
 * Başında + olmadığından CSV'de formül önlemi (') gerekmez ve Excel'de okunaklı kalır.
 */
export function displayPhone(e164: string): string {
  const m = e164.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `0${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  // Boşluk: Excel'in sayıya çevirip baştaki sıfırları atmasını engeller.
  return e164.replace(/^\+(\d{2})/, "00$1 ");
}
