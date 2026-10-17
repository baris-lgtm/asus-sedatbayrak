import Link from "next/link";

export default function NotFound() {
  return (
    <main id="icerik" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-4 py-20 sm:px-8">
      <h1 className="display text-6xl">Sayfa bulunamadı</h1>
      <p className="mt-4 text-lg text-graphite">Aradığın sayfa taşınmış veya hiç var olmamış olabilir.</p>
      <Link href="/" className="btn btn-primary mt-8 self-start">Ana sayfaya dön</Link>
    </main>
  );
}
