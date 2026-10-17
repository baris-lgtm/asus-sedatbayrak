#!/usr/bin/env node
/**
 * Ekip kullanıcısı ekler veya rolünü günceller.
 *
 *   npm run staff:add -- kisi@ornek.com admin
 *   npm run staff:add -- kapi@ornek.com checkin
 *
 * Kullanıcı yoksa güçlü bir geçici parola ile oluşturulur ve parola BİR KEZ ekrana yazılır.
 * Gerekli ortam değişkenleri (.env.local veya ortamdan): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const [email, role = "admin"] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !["admin", "checkin"].includes(role)) {
  console.error("Kullanım: npm run staff:add -- <e-posta> <admin|checkin>");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı (.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId;
let password;
for (let page = 1; !userId; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (data.users.length < 1000) break;
}
if (!userId) {
  password = randomBytes(18).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
}
const { error } = await db.from("staff_members").upsert({ user_id: userId, role }, { onConflict: "user_id" });
if (error) throw error;

console.log(`✓ ${email} → ${role}`);
if (password) console.log(`  Geçici parola (bir kez gösterilir, güvenli şekilde ilet): ${password}`);
else console.log("  Kullanıcı zaten vardı; yalnızca rolü güncellendi.");
