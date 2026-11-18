import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, ProgramMark } from "@/components/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { StageQuestionForm } from "./stage-question-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sahneye Soru Sor",
  description: "Mimarlığın Evrimi oturumunda konuşmacılara sormak istediğiniz soruyu gönderin.",
  robots: { index: false, follow: false },
};

async function isOpen(): Promise<boolean> {
  const { data, error } = await createAdminClient().from("stage_settings").select("is_open").eq("id", 1).single();
  if (error) throw new Error("Soru ayarı okunamadı");
  return Boolean(data?.is_open);
}

export default async function StageQuestionPage() {
  const open = await isOpen();
  return (
    <div className="flex min-h-dvh flex-col bg-night font-headline text-white">
      <header className="border-b border-white/10">
        <nav aria-label="Üst menü" className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Ana sayfa" className="flex items-center gap-4 text-lg">
            <BrandMark />
            <span aria-hidden className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="hidden sm:block">
              <ProgramMark className="text-[13px]" />
            </span>
          </Link>
          <Link href="/" className="text-[13px] text-white/70 hover:text-white">
            Ana sayfa
          </Link>
        </nav>
      </header>
      <main id="icerik" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-16">
        <p className="eyebrow-line rise">Mimarlığın Evrimi · Soru-cevap</p>
        <h1 className="headline rise rise-1 mt-5 text-[2.4rem] sm:text-6xl">Sahneye Sorunu Gönder</h1>
        <p className="rise rise-2 mt-5 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-base">
          Mimarlığın Evrimi oturumunda konuşmacılarımıza sormak istediğiniz soruyu yazın. Moderatör, seçilen soruları
          soru-cevap bölümünde sahneye iletecek.
        </p>
        <div className="rise rise-3 mt-8 sm:mt-10">
          {open ? (
            <StageQuestionForm />
          ) : (
            <div role="status" className="rounded-[4px] border border-white/12 bg-white/[0.03] p-7">
              <h2 className="headline text-2xl">Soru alımı şu anda kapalı</h2>
              <p className="mt-2 text-[15px] text-white/65">Soru-cevap bölümünde yeniden açılacak.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
