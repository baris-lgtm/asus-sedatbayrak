import { readFileSync } from "node:fs";
import path from "node:path";

/** .env.local'ı okur (yerel Supabase anahtarları ve test e-posta dizini). */
export function loadLocalEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* yoksa process.env kullanılır */
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in out && process.env[k])) } as Record<string, string>;
}
