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
