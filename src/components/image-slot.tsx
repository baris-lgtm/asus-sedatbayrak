import Image from "next/image";
import type { ImageSlot as Slot } from "@/config/event";

/**
 * Değiştirilebilir görsel alanı. src tanımlıysa gerçek görsel, değilse
 * taş tonlu sessiz bir yüzey ve hangi görselin bekleneceğini söyleyen küçük etiket.
 * Görsel eklemek için: dosyayı public/ altına koy, src/config/event.ts'de yolu yaz.
 */
export function ImageSlot({
  slot,
  className = "",
  dark = false,
  sizes = "100vw",
  priority = false,
  rounded = true,
  labelRight = false,
  fit = "cover",
}: {
  slot: Slot;
  className?: string;
  dark?: boolean;
  sizes?: string;
  priority?: boolean;
  rounded?: boolean;
  /** Maskeyle soldan eritilen görsellerde etiket sağ altta durur. */
  labelRight?: boolean;
  /** "contain": dekupe (şeffaf zeminli) ürün görselleri için. */
  fit?: "cover" | "contain";
}) {
  const radius = rounded ? "rounded-[3px]" : "";
  if (slot.src) {
    return (
      <div className={`relative overflow-hidden ${radius} ${className}`}>
        <Image src={slot.src} alt={slot.alt} fill sizes={sizes} priority={priority} className={fit === "contain" ? "object-contain" : "object-cover"} />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${slot.alt} (görsel henüz eklenmedi)`}
      className={`${dark ? "image-slot-dark text-neutral-400" : "image-slot text-graphite/80"} relative overflow-hidden ${radius} ${className}`}
    >
      {/* Hangi görselin bekleneceği yalnızca geliştirmede yazılır; canlıda sade yüzey kalır. */}
      {process.env.NODE_ENV !== "production" && (
        <span className={`absolute bottom-3 ${labelRight ? "right-4 text-right" : "left-3"} max-w-[30ch] text-[10px] font-medium uppercase leading-snug tracking-[0.18em]`}>
          {slot.placeholderLabel}
        </span>
      )}
    </div>
  );
}
