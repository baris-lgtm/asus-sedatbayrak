import { ImageResponse } from "next/og";
import { eventContent } from "@/config/event";

// Sosyal medya paylaşım görseli (onaylı görsel gelene kadar tipografik).
export const alt = eventContent.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#000", color: "#fff", padding: "64px 72px" }}>
        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.03em", flexDirection: "column" }}>
          <span>ASUS ×</span>
          <span>Sedat Bayrak</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", height: 2, background: "#fff", width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 36 }}>
            <span>Workshop</span>
            <span style={{ color: "#1F44FF", background: "#fff", padding: "4px 16px" }}>Başvurular açık</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
