import Link from "next/link";
import { eventContent } from "@/config/event";

export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <p className="condensed text-2xl font-bold">{eventContent.title}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-400">
            {eventContent.brand} ve {eventContent.artist} iş birliğiyle düzenlenen yaratıcı üretim atölyesi.
          </p>
        </div>
        <div className="text-sm">
          <p className="text-neutral-400">İletişim</p>
          {eventContent.contact.email ? (
            <a href={`mailto:${eventContent.contact.email}`} className="mt-2 inline-block font-semibold underline underline-offset-4">
              {eventContent.contact.email}
            </a>
          ) : (
            <p className="mt-2">İletişim adresi yakında eklenecek.</p>
          )}
        </div>
        <nav aria-label="Yasal" className="text-sm">
          <ul className="space-y-2">
            <li>
              <Link href="/kvkk" className="underline underline-offset-4">KVKK aydınlatma metni</Link>
            </li>
            <li>
              <Link href="/gizlilik" className="underline underline-offset-4">Gizlilik ve çerezler</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-neutral-500 sm:px-8">
          © {year} {eventContent.brand}. Tüm hakları saklıdır.
        </p>
      </div>
    </footer>
  );
}
