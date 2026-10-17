import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ekip girişi", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const staff = await getStaff().catch(() => null);
  if (staff) redirect(staff.role === "admin" ? "/admin" : "/admin/check-in");

  return (
    <main id="icerik" className="grid min-h-dvh place-items-center bg-ink px-4 py-12">
      <div className="w-full max-w-sm bg-paper p-8">
        <h1 className="display text-4xl">Ekip girişi</h1>
        <p className="mt-2 text-sm text-graphite">Yalnızca yetkili etkinlik ekibi içindir.</p>
        <LoginForm />
      </div>
    </main>
  );
}
