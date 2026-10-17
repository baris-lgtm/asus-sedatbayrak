import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Page } from "@playwright/test";
import { loadLocalEnv } from "./env";

export const env = loadLocalEnv();
export const MAIL_DIR = env.EMAIL_TEST_SINK_DIR || "/var/tmp/workshop-mail";

export const USERS = {
  admin: { email: "admin@test.local", password: "Admin-Test-Parola-1!" },
  door: { email: "kapi@test.local", password: "Kapi-Test-Parola-1!" },
  outsider: { email: "disari@test.local", password: "Disari-Test-Parola-1!" },
} as const;

export function service() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anon() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** @supabase/ssr'nin üreteceği oturum çerezlerinin aynısını üretir (API testleri için). */
export async function sessionCookies(user: { email: string; password: string }) {
  const jar = new Map<string, string>();
  const sb = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const c of list) {
          if (c.value) jar.set(c.name, c.value);
          else jar.delete(c.name);
        }
      },
    },
  });
  const { error } = await sb.auth.signInWithPassword(user);
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value }));
}

export function cookieHeader(cookies: { name: string; value: string }[]) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function uiLogin(page: Page, user: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.getByLabel("E-posta", { exact: true }).fill(user.email);
  await page.getByLabel("Parola").fill(user.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  // Ya panele yönlendirilir ya da hata mesajı görünür — hangisi önce olursa.
  await Promise.race([
    page.waitForURL((u) => !u.pathname.endsWith("/admin/login"), { timeout: 15_000 }),
    page.locator("main [role=alert]").waitFor({ timeout: 15_000 }),
  ]).catch(() => undefined);
}

export interface SinkMail {
  id: string;
  to: string;
  type: string;
  subject: string;
  text: string;
  attachments: { filename: string; contentId: string; bytes: number }[];
}

export function mails(): SinkMail[] {
  try {
    return readdirSync(MAIL_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(path.join(MAIL_DIR, f), "utf8")) as SinkMail);
  } catch {
    return [];
  }
}

export function mailsTo(to: string, type?: string) {
  return mails().filter((m) => m.to === to && (!type || m.type === type));
}

/** Davetiye e-postasından QR URL'si ve giriş kodu. */
export function invitationFromMail(m: SinkMail) {
  const url = m.text.match(/Davetiyen: (\S+)/)?.[1];
  const code = m.text.match(/Giriş kodun \(QR okutulamazsa\): (\S+)/)?.[1];
  if (!url || !code) throw new Error("Davetiye e-postasında URL/kod yok");
  return { url, code, token: url.split("/").pop() as string };
}

let counter = 0;
/** Testler arası çakışmayan benzersiz e-posta. */
export function uniqueEmail(prefix = "katilimci") {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}@example.com`;
}

/** Doğrudan servis istemcisiyle başvuru oluşturur (form akışından bağımsız testler için). */
export async function seedApplication(overrides: Record<string, unknown> = {}) {
  const email = (overrides.email as string) ?? uniqueEmail("seed");
  const { data, error } = await service()
    .from("applications")
    .insert({
      first_name: "Deneme",
      last_name: "Kişi",
      email,
      phone: "+905551112233",
      participant_type: "student",
      institution: "Test Üniversitesi",
      department: "Mimarlık",
      kvkk_notice_version: "TASLAK-v0",
      ...overrides,
    })
    .select("id, email")
    .single<{ id: string; email: string }>();
  if (error) throw error;
  return data;
}

export async function setCapacity(capacity: number) {
  const { error } = await service().from("event_settings").update({ capacity }).eq("id", 1);
  if (error) throw error;
}

export async function countTaken() {
  const { count } = await service()
    .from("applications")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "checked_in"]);
  return count ?? 0;
}
