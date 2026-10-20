import Link from "next/link";
import { ArrowRight, BrandMark } from "@/components/brand";

const NAV = [
  { href: "/#yaklasim", label: "Etkinlik" },
  { href: "/#sedat-bayrak", label: "Sedat Bayrak" },
  { href: "/#urun", label: "Ürün Deneyimi" },
  { href: "/#sss", label: "Sıkça Sorulan Sorular" },
];

export function SiteHeader({ showNav = true }: { showNav?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule/70 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <nav aria-label="Ana menü" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="ASUS × Sedat Bayrak Workshop — ana sayfa" className="text-lg">
          <BrandMark />
        </Link>
        {showNav && (
          <ul className="hidden items-center gap-9 text-[13px] text-ink/80 md:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a className="transition-colors hover:text-ink" href={n.href}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <a href="/#basvuru" className="btn btn-primary arrow-nudge min-h-10 px-4 text-[13px]">
          Başvur
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </nav>
    </header>
  );
}
