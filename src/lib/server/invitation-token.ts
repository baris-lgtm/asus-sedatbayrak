/**
 * Davetiye token'ları — YALNIZCA SUNUCU TARAFINDA kullanılır.
 *
 * Tasarım:
 *  - Davetiye id'si sunucuda rastgele UUID olarak üretilir.
 *  - QR token  = base64url(HMAC-SHA256(INVITATION_TOKEN_SECRET, "qr:"   + id))  → 43 karakter, 256 bit
 *  - Manuel kod = Crockford base32(HMAC-SHA256(secret, "code:" + id)) ilk 10 karakter → ~50 bit,
 *    kapıda elle yazmak için (yalnızca yetkili personelin check-in ekranından denenebilir).
 *  - Veritabanında yalnızca SHA-256 hash'leri saklanır.
 *  - Token id'den yeniden türetilebildiği için "davetiyeyi tekrar gönder" aynı QR'ı üretir
 *    (idempotent); yeniden üretme (reissue) yeni id → yeni token demektir.
 *  - QR içinde ad, e-posta, telefon vb. HİÇBİR kişisel veri yoktur.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const MANUAL_CODE_LENGTH = 10;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("INVITATION_TOKEN_SECRET tanımlı değil veya 32 karakterden kısa.");
  }
  return secret;
}

function hmac(secret: string, label: string, invitationId: string): Buffer {
  return createHmac("sha256", requireSecret(secret)).update(`${label}:${invitationId}`).digest();
}

function toCrockford(bytes: Buffer, length: number): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
    if (out.length >= length) break;
  }
  return out;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function deriveQrToken(invitationId: string, secret: string): string {
  return hmac(secret, "qr", invitationId).toString("base64url");
}

export function deriveManualCode(invitationId: string, secret: string): string {
  return toCrockford(hmac(secret, "code", invitationId), MANUAL_CODE_LENGTH);
}

/** Kullanıcıya gösterim için: ABCD-EFGH-JK */
export function formatManualCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** Kapıda elle girilen kodu normalize eder (Crockford: O→0, I/L→1, tire/boşluk yok sayılır). */
export function normalizeManualCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== MANUAL_CODE_LENGTH) return null;
  for (const ch of cleaned) if (!CROCKFORD.includes(ch)) return null;
  return cleaned;
}

/** Yeni davetiye için id + DB'ye gidecek hash'ler + (yalnızca e-postada kullanılacak) düz token'lar. */
export function issueInvitation(secret: string) {
  const invitationId = randomUUID();
  return { invitationId, ...materialFor(invitationId, secret) };
}

/** Var olan davetiye için token'ları yeniden türetir (tekrar gönderim). */
export function materialFor(invitationId: string, secret: string) {
  const qrToken = deriveQrToken(invitationId, secret);
  const manualCode = deriveManualCode(invitationId, secret);
  return {
    qrToken,
    manualCode,
    qrTokenHash: sha256Hex(qrToken),
    manualCodeHash: sha256Hex(manualCode),
  };
}

/** Davetiye sayfası/QR içeriği: tahmin edilemez token içeren URL. */
export function invitationUrl(siteUrl: string, qrToken: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/davetiye/${qrToken}`;
}

/**
 * Okutulan QR içeriğinden token'ı çıkarır. Ham token veya
 * <site>/davetiye/<token> biçimindeki URL kabul edilir. Diğer her şey null.
 */
export function extractTokenFromScan(scanned: string): string | null {
  const value = scanned.trim();
  if (TOKEN_RE.test(value)) return value;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/davetiye\/([A-Za-z0-9_-]{43})\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** Sabit zamanlı karşılaştırma (ör. cron secret kontrolü). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
