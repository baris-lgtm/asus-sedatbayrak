import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Hukuk onaylı metin gelene kadar açıkça TASLAK olarak işaretlenen yasal sayfa iskeleti. */
export function LegalPage({ title, version, sections }: { title: string; version: string; sections: string[] }) {
  return (
    <>
      <SiteHeader showNav={false} />
      <main id="icerik" className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <h1 className="display text-5xl sm:text-6xl">{title}</h1>
        <p className="mt-4 text-sm text-graphite">Metin sürümü: {version}</p>
        <div role="note" className="mt-8 border-2 border-dashed border-warn p-5 text-warn">
          <p className="font-semibold">Bu sayfa taslaktır.</p>
          <p className="mt-2 leading-relaxed">
            Hukuken geçerli metin, veri sorumlusu ve hukuk danışmanı tarafından hazırlanıp onaylandıktan sonra buraya
            eklenecektir. Aşağıdaki başlıklar yalnızca metnin kapsaması gereken konuları gösterir.
          </p>
        </div>
        <ol className="mt-10 list-decimal space-y-3 pl-6 leading-relaxed">
          {sections.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
