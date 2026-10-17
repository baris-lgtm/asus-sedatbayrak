import Image from "next/image";
import type { ImageSlot as Slot } from "@/config/event";

/**
 * Değiştirilebilir görsel alanı. src tanımlıysa gerçek görsel, değilse
 * hangi görselin bekleneceğini söyleyen pafta biçimli placeholder.
 * Görsel eklemek için: dosyayı public/ altına koy, src/config/event.ts'de yolu yaz.
 */
export function ImageSlot({
  slot,
  className = "",
  dark = false,
  sizes = "100vw",
  priority = false,
}: {
  slot: Slot;
  className?: string;
  dark?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  if (slot.src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={slot.src} alt={slot.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${slot.alt} (görsel henüz eklenmedi)`}
      className={`${dark ? "image-slot-dark text-neutral-400" : "image-slot text-graphite"} relative flex items-end p-4 ${className}`}
    >
      <span aria-hidden className={`absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 ${dark ? "border-neutral-500" : "border-ink"}`} />
      <span aria-hidden className={`absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 ${dark ? "border-neutral-500" : "border-ink"}`} />
      <span aria-hidden className={`absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 ${dark ? "border-neutral-500" : "border-ink"}`} />
      <span aria-hidden className={`absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 ${dark ? "border-neutral-500" : "border-ink"}`} />
      <span className="relative max-w-[28ch] pl-4 pb-4 text-xs leading-snug">{slot.placeholderLabel}</span>
    </div>
  );
}
