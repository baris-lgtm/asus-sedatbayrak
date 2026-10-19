/** Yavaş bağlantıda sayfa geçişlerinde geri bildirim. */
export default function PanelLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-10 text-graphite">
      <span aria-hidden className="h-3 w-3 animate-pulse bg-ink" />
      Yükleniyor…
    </div>
  );
}
