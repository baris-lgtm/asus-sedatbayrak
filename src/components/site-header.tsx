import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { MobileMenu } from "@/components/mobile-menu";

export const NAV = [
  { href: "/#etkinlik", label: "Etkinlik Hakkında" },
  { href: "/#program", label: "Program" },
  { href: "/#konusmacilar", label: "Konuşmacılar" },
  { href: "/#proart", label: "ProArt P16" },
];

export function SiteHeader({ showNav = true }: { showNav?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-night/85 font-headline text-white backdrop-blur-md">
      <nav aria-label="Ana menü" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Ana sayfa" className="text-lg">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-9">
          {showNav && (
            <ul className="hidden items-center gap-8 text-[13px] text-white/80 lg:flex">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a className="transition-colors hover:text-white" href={n.href}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/#basvuru"
            className="inline-flex min-h-10 items-center rounded-[3px] border border-copper px-4 text-[13px] text-copper transition-colors hover:bg-copper hover:text-night"
          >
            Başvur
          </a>
          {showNav && <MobileMenu items={NAV} />}
        </div>
      </nav>
    </header>
  );
}
