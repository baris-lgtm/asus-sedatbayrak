import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { eventContent } from "@/config/event";
import { siteUrl } from "@/lib/env";
import { ConsentAndAnalytics } from "@/components/analytics";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: eventContent.title,
    template: `%s | ${eventContent.title}`,
  },
  description: `${eventContent.tagline} Katılım başvuru ve onay ile.`,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    title: eventContent.title,
    description: eventContent.tagline,
    siteName: eventContent.title,
  },
  twitter: { card: "summary_large_image", title: eventContent.title, description: eventContent.tagline },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={archivo.variable}>
      <body className="min-h-dvh antialiased">
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-4 focus:py-2"
        >
          İçeriğe geç
        </a>
        {children}
        <ConsentAndAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      </body>
    </html>
  );
}
