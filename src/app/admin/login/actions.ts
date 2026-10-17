"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

const schema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "E-posta ve parolanı yaz." };

  const ip = await clientIp();
  if (!(await rateLimit(hashKey("login-ip", ip), 10, 600)) || !(await rateLimit(hashKey("login-email", parsed.data.email), 5, 600))) {
    return { error: "Çok fazla deneme yapıldı. 10 dakika sonra tekrar dene." };
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "E-posta veya parola hatalı." };

  const { data: staff } = await supabase.from("staff_members").select("role").eq("user_id", data.user.id).maybeSingle<{ role: string }>();
  if (!staff) {
    await supabase.auth.signOut();
    return { error: "Bu hesabın yönetim paneline erişim yetkisi yok." };
  }
  redirect(staff.role === "admin" ? "/admin" : "/admin/check-in");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
