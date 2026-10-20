/* eslint-disable @next/next/no-img-element -- partner logosu SVG */
import Link from "next/link";
import { eventContent } from "@/config/event";
import { BrandLockup } from "@/components/brand";

export function SiteFooter() {
  const year = 2026;
  const partner = eventContent.creativePartner;
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <BrandLockup className="text-2xl" />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-graphite">
            {eventContent.brand} ve {eventContent.artist} iş birliğiyle düzenlenen yaratıcı üretim atölyesi.
          </p>
        </div>
        {partner && (
          <div className="md:text-right">
            <p className="text-[10px] text-graphite">Kreatif partner</p>
            {eventContent.logos.partner ? (
              <img src={eventContent.logos.partner} alt={partner} className="mt-2 h-4 w-auto md:ml-auto" />
            ) : (
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.32em]">{partner}</p>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-[13px] text-graphite sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>© {year} {eventContent.brand}. Tüm hakları saklıdır.</p>
          <nav aria-label="Yasal ve iletişim">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              <li>
                <Link href="/kvkk" className="hover:text-ink">KVKK aydınlatma metni</Link>
              </li>
              <li>
                <Link href="/gizlilik" className="hover:text-ink">Gizlilik ve çerezler</Link>
              </li>
              {eventContent.contact.email && (
                <li>
                  <a href={`mailto:${eventContent.contact.email}`} className="hover:text-ink">
                    {eventContent.contact.email}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
