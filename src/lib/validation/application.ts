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

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} alanını doldurmalısın.` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(1, `${label} alanını doldurmalısın.`)
        .max(max, `${label} en fazla ${max} karakter olabilir.`),
    );

export const MOTIVATION_MAX = 600;

export const applicationSchema = z.object({
  firstName: requiredText("Ad", 80),
  lastName: requiredText("Soyad", 80),
  email: z
    .string({ error: "E-posta adresini yazmalısın." })
    .trim()
    .min(1, "E-posta adresini yazmalısın.")
    .max(254, "E-posta adresi çok uzun.")
    .pipe(z.email("Geçerli bir e-posta adresi yaz (ör. ad@ornek.com).")),
  phone: z
    .string({ error: "Telefon numaranı yazmalısın." })
    .trim()
    .min(1, "Telefon numaranı yazmalısın.")
    .refine((v) => normalizePhone(v) !== null, "Geçerli bir telefon numarası yaz (ör. 0555 111 22 33).")
    .transform((v) => normalizePhone(v) as string),
  participantType: z.enum(PARTICIPANT_TYPES, { error: "Meslek veya öğrenci durumunu seç." }),
  institution: requiredText("Kurum / üniversite", 160),
  department: requiredText("Bölüm / uzmanlık alanı", 160),
  motivation: z
    .string()
    .transform(clean)
    .pipe(z.string().max(MOTIVATION_MAX, `En fazla ${MOTIVATION_MAX} karakter yazabilirsin.`))
    .optional(),
  kvkkAcknowledged: z.literal(true, { error: "Devam etmek için aydınlatma metnini okuduğunu onaylamalısın." }),
  marketingConsent: z.boolean().optional().default(false),
  /** Honeypot: gerçek kullanıcılar bu alanı görmez ve boş bırakır. */
  website: z.string().optional(),
  turnstileToken: z.string().max(4096).optional(),
});

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
