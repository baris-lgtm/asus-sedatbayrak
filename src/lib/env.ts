/**
 * Ortam değişkenleri. Değerler ilk kullanımda okunur (build sırasında eksik
 * olmaları derlemeyi kırmaz; çalışma anında anlaşılır hata verir).
 */
export class ConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Eksik yapılandırma: ${variable}`);
    this.name = "ConfigError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(name);
  return value;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublicKey(): string {
  // Yeni Supabase projeleri "publishable key", eskileri "anon key" kullanır; ikisi de desteklenir.
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new ConfigError("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return v;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
