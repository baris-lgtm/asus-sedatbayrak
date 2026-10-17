import Link from "next/link";
import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Yönetim", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const links =
    staff.role === "admin"
      ? [
          { href: "/admin", label: "Başvurular" },
          { href: "/admin/check-in", label: "Check-in" },
          { href: "/admin/ayarlar", label: "Etkinlik ayarları" },
        ]
      : [{ href: "/admin/check-in", label: "Check-in" }];

  return (
    <div className="min-h-dvh bg-mist">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href={links[0].href} className="condensed text-lg font-bold">
            Workshop yönetimi
          </Link>
          <nav aria-label="Yönetim menüsü" className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto">
            <ul className="flex gap-5 text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-2 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <form action={signOut} className="flex items-center gap-3 text-sm">
            <span className="hidden text-neutral-400 md:inline">{staff.email}</span>
            <button type="submit" className="underline underline-offset-4">
              Çıkış yap
            </button>
          </form>
        </div>
      </header>
      <main id="icerik" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
