import { mkdirSync, rmSync } from "node:fs";
import { MAIL_DIR, USERS, env, service } from "./helpers";

/**
 * Yerel Supabase'i temiz duruma getirir: verileri siler, test kullanıcılarını
 * ve personel rollerini oluşturur. YALNIZCA yerel ortamda çalışır.
 */
export default async function globalSetup() {
  const db = service();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url && !/127\.0\.0\.1|localhost/.test(url)) throw new Error("E2E testleri yalnızca yerel Supabase'e karşı çalışır.");

  for (const table of ["email_logs", "invitations", "admin_audit_logs", "applications", "rate_limits"]) {
    const col = table === "rate_limits" ? "key" : "id";
    const { error } = await db.from(table).delete().not(col, "is", null);
    if (error) throw new Error(`${table} temizlenemedi: ${error.message}`);
  }
  await db
    .from("event_settings")
    .update({
      capacity: 300,
      applications_open: true,
      date_confirmed: false,
      venue_confirmed: false,
      starts_at: null,
      ends_at: null,
      venue_name: null,
      venue_address: null,
      venue_map_url: null,
      transport_info: null,
    })
    .eq("id", 1);

  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) await db.auth.admin.deleteUser(u.id);

  const ids: Record<string, string> = {};
  for (const [key, u] of Object.entries(USERS)) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error || !data.user) throw new Error(`Kullanıcı oluşturulamadı: ${error?.message}`);
    ids[key] = data.user.id;
  }
  const { error } = await db.from("staff_members").insert([
    { user_id: ids.admin, role: "admin" },
    { user_id: ids.door, role: "checkin" },
  ]);
  if (error) throw new Error(`Personel rolleri eklenemedi: ${error.message}`);

  rmSync(MAIL_DIR, { recursive: true, force: true });
  mkdirSync(MAIL_DIR, { recursive: true });
}
