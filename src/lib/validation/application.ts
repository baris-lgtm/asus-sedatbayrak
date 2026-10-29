/**
 * Başvuru formu doğrulaması — İSTEMCİ ve SUNUCU aynı şemayı kullanır.
 * (Sunucu, istemciden gelen hiçbir şeye güvenmeden yeniden doğrular.)
 */
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { PARTICIPANT_TYPES } from "@/lib/types";

// Kontrol karakterlerini temizler, boşlukları sadeleştirir.
const clean = (v: string) =>
  v.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();

export const MOTIVATION_MAX = 600;
export const TOOLS_MAX = 300;

/** "Ayşe Nur Yılmaz" → ad "Ayşe Nur", soyad "Yılmaz" (son kelime soyad). */
export function splitFullName(full: string): { firstName: string; lastName: string } | null {
  const words = clean(full).split(" ").filter(Boolean);
  if (words.length < 2) return null;
  return { firstName: words.slice(0, -1).join(" "), lastName: words[words.length - 1] };
}

export const applicationSchema = z
  .object({
    fullName: z
      .string({ error: "Adınızı ve soyadınızı yazın." })
      .transform(clean)
      .pipe(
        z
          .string()
          .min(1, "Adınızı ve soyadınızı yazın.")
          .max(161, "Ad soyad en fazla 160 karakter olabilir.")
          .refine((v) => splitFullName(v) !== null, "Adınızı ve soyadınızı birlikte yazın (ör. Ayşe Yılmaz).")
          .refine((v) => {
            const n = splitFullName(v);
            return !n || (n.firstName.length <= 80 && n.lastName.length <= 80);
          }, "Ad veya soyad çok uzun."),
      ),
    email: z
      .string({ error: "E-posta adresinizi yazın." })
      .trim()
      .min(1, "E-posta adresinizi yazın.")
      .max(254, "E-posta adresi çok uzun.")
      .pipe(z.email("Geçerli bir e-posta adresi yazın (ör. ad@ornek.com).")),
    phone: z
      .string({ error: "Telefon numaranızı yazın." })
      .trim()
      .min(1, "Telefon numaranızı yazın.")
      .refine((v) => normalizePhone(v) !== null, "Geçerli bir telefon numarası yazın (ör. 0555 111 22 33).")
      .transform((v) => normalizePhone(v) as string),
    participantType: z.enum(PARTICIPANT_TYPES, { error: "Profesyonel / öğrenci durumunuzu seçin." }),
    institution: z
      .string({ error: "Kurum veya okulunuzu yazın." })
      .transform(clean)
      .pipe(z.string().min(1, "Kurum veya okulunuzu yazın.").max(160, "En fazla 160 karakter yazabilirsiniz.")),
    tools: z
      .string()
      .transform(clean)
      .pipe(z.string().max(TOOLS_MAX, `En fazla ${TOOLS_MAX} karakter yazabilirsiniz.`))
      .optional(),
    motivation: z
      .string({ error: "Katılım motivasyonunuzu kısaca yazın." })
      .transform(clean)
      .pipe(
        z
          .string()
          .min(1, "Katılım motivasyonunuzu kısaca yazın.")
          .max(MOTIVATION_MAX, `En fazla ${MOTIVATION_MAX} karakter yazabilirsiniz.`),
      ),
    kvkkAcknowledged: z.literal(true, { error: "Devam etmek için aydınlatma metnini okuduğunuzu onaylayın." }),
    marketingConsent: z.boolean().optional().default(false),
    /** Honeypot: gerçek kullanıcılar bu alanı görmez ve boş bırakır. */
    website: z.string().optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .transform((v) => ({ ...v, ...(splitFullName(v.fullName) as { firstName: string; lastName: string }) }));

export type ApplicationInput = z.input<typeof applicationSchema>;
export type ApplicationData = z.output<typeof applicationSchema>;

export type FieldErrors = Partial<Record<keyof ApplicationInput, string>>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof ApplicationInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
