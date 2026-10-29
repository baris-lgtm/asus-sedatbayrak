import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { LegalDoc } from "@/content/legal";

const EMAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Paragraftaki e-posta adreslerini tıklanabilir yapar; metnin kendisi değişmez. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(EMAIL);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={`mailto:${p}`} className="text-copper-ink underline underline-offset-4">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function LegalPage({ doc, version, related }: { doc: LegalDoc; version?: string; related?: { href: string; label: string } }) {
  return (
    <div className="bg-cream font-headline text-ink">
      <SiteHeader showNav={false} />
      <main id="icerik" className="mx-auto max-w-3xl px-4 py-16 sm:px-8 lg:py-20">
        <p className="eyebrow-line !text-[13px] !normal-case !tracking-normal !text-copper-ink">{doc.subtitle}</p>
        <h1 className="headline mt-6 text-[clamp(2.2rem,5vw,3.2rem)]">{doc.title}</h1>
        <p className="mt-4 text-[13px] text-graphite">
          Son güncelleme: {doc.updated}
          {version && <> · Metin sürümü: {version}</>}
        </p>
        <div className="mt-12 space-y-10">
          {doc.sections.map((s, i) => (
            <section key={s.heading} aria-labelledby={`b${i}`}>
              <h2 id={`b${i}`} className="text-lg font-medium">
                <span className="mr-3 text-copper-ink">{i + 1}.</span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-[#3f3b36]">
                {s.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>
                    <Linkified text={p} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        {related && (
          <p className="mt-14 border-t border-ink/12 pt-6 text-sm">
            <Link href={related.href} className="text-copper-ink underline underline-offset-4">
              {related.label}
            </Link>
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
