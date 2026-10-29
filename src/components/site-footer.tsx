/* eslint-disable @next/next/no-img-element -- partner logosu SVG */
import Link from "next/link";
import { eventContent } from "@/config/event";
import { BrandMark, ProgramMark } from "@/components/brand";
import { NAV } from "@/components/site-header";

export function SiteFooter() {
  const year = 2026;
  const partner = eventContent.creativePartner;
  const socials = eventContent.socials.filter((s) => s.url);
  return (
    <footer className="bg-night font-headline text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5 text-lg">
          <BrandMark />
          <span aria-hidden className="h-5 w-px bg-white/30" />
          <ProgramMark className="text-[13px]" />
        </div>
        <nav aria-label="Alt menü">
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-white/75">
            {[...NAV.slice(0, 3), { href: "/#basvuru", label: "Başvur" }].map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-white">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {socials.length > 0 && (
          <ul className="flex gap-5 text-[12px] uppercase tracking-[0.12em] text-white/75">
            {socials.map((s) => (
              <li key={s.kind}>
                <a href={s.url!} target="_blank" rel="noopener noreferrer" className="hover:text-copper">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-[12px] text-white/50 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>© {year} {eventContent.brand}. Tüm hakları saklıdır.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/kvkk" className="hover:text-white">KVKK Aydınlatma Metni</Link>
            </li>
            <li>
              <Link href="/gizlilik" className="hover:text-white">Gizlilik Politikası</Link>
            </li>
            {eventContent.contact.email && (
              <li>
                <a href={`mailto:${eventContent.contact.email}`} className="hover:text-white">
                  {eventContent.contact.email}
                </a>
              </li>
            )}
            {partner && (
              <li>
                Kreatif partner:{" "}
                {eventContent.logos.partner ? (
                  <img src={eventContent.logos.partner} alt={partner} className="inline h-3 w-auto align-middle" />
                ) : (
                  <span lang="en" className="uppercase tracking-[0.2em] text-white/70">{partner}</span>
                )}
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
