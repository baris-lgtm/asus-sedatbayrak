"use client";

// Panel düzeninin (layout) kendisi yüklenemezse (ör. oturum doğrulanırken bağlantı koptu)
// bu sınır devreye girer. Sayfa içi hatalar için (panel)/error.tsx kullanılır.
import PanelError from "./(panel)/error";

export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="icerik" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PanelError {...props} />
    </main>
  );
}
