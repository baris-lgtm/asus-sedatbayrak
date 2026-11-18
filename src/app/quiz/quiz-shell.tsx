import Link from "next/link";
import { BrandMark, ProgramMark } from "@/components/brand";

/** Quiz ve liderlik sayfalarının sade, koyu kabuğu (başvuru menüsü yok). */
export function QuizShell({ children, active }: { children: React.ReactNode; active: "quiz" | "liderlik" }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`inline-flex min-h-10 items-center rounded-[3px] px-3.5 text-[13px] transition-colors ${
        on ? "border border-copper text-copper" : "text-white/75 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex min-h-dvh flex-col bg-night font-headline text-white">
      <header className="border-b border-white/10">
        <nav aria-label="Quiz menüsü" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Ana sayfa" className="flex items-center gap-4 text-lg">
            <BrandMark />
            <span aria-hidden className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="hidden sm:block">
              <ProgramMark className="text-[13px]" />
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {link("/quiz", "Quiz", active === "quiz")}
            {link("/quiz/liderlik", "Liderlik", active === "liderlik")}
          </div>
        </nav>
      </header>
      <main id="icerik" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
