import type { EventSettings } from "@/lib/types";

const TZ = "Europe/Istanbul";

/** "31 Ekim 2026 Cumartesi" — tarih kesinleşmediyse null. */
export function formatEventDate(s: Pick<EventSettings, "starts_at" | "date_confirmed">): string | null {
  if (!s.date_confirmed || !s.starts_at) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(s.starts_at));
}

/** "12.00 – 17.00" — tarih kesinleşmediyse null. */
export function formatEventTimeRange(s: Pick<EventSettings, "starts_at" | "ends_at" | "date_confirmed">): string | null {
  if (!s.date_confirmed || !s.starts_at) return null;
  const f = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const start = f.format(new Date(s.starts_at));
  return s.ends_at ? `${start} – ${f.format(new Date(s.ends_at))}` : start;
}

/** Admin ekranları için: "17.10.2026 15:08" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** ISO → <input type="datetime-local"> değeri (İstanbul saati). */
export function toIstanbulLocalInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

/** <input type="datetime-local"> değeri (İstanbul saati, UTC+3 sabit) → ISO. */
export function fromIstanbulLocalInput(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
