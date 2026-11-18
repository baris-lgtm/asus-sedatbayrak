/**
 * Quiz için istemci + sunucuda ortak, saf yardımcılar.
 */

/** Herkese açık liderlikte ad + soyadın baş harfi: "Ömer Faruk Yılmaz" → "Ömer Faruk Y." */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(" ")} ${last.charAt(0).toLocaleUpperCase("tr-TR")}.`;
}

/** 83_450 ms → "1:23,4" ; 3_725_000 → "62:05,0" */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalTenths = Math.floor(safe / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(s).padStart(2, "0")},${tenths}`;
}

/** Ad soyad: en az iki kelime, 3–80 karakter, harf/boşluk/kesme/tire. */
export function normalizeQuizName(raw: string): string | null {
  const v = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (v.length < 3 || v.length > 80) return null;
  if (!/^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(v)) return null;
  if (v.split(" ").filter((w) => /\p{L}/u.test(w)).length < 2) return null;
  return v;
}

export const QUIZ_PRIZE_COUNT = 15;
