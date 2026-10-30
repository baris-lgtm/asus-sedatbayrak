"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Tablet ve telefon için açılır menü (lg altı). */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobil-menu"
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        className="grid h-10 w-10 place-items-center rounded-[3px] text-white/90 hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-6 w-6">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {/* Başlıktaki backdrop-filter "fixed" konumu bozmasın diye body'ye taşınır */}
      {open &&
        createPortal(
        <div id="mobil-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 font-headline overflow-y-auto bg-night/[0.98] backdrop-blur-md">
          <nav aria-label="Mobil menü" className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8">
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {items.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-5 font-headline text-2xl text-white/90 hover:text-copper"
                  >
                    {n.label}
                    <span aria-hidden className="text-copper">→</span>
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="/#basvuru"
              onClick={() => setOpen(false)}
              className="btn-copper mt-8 w-full"
            >
              Katılım için başvur
            </a>
          </nav>
        </div>,
          document.body,
        )}
    </div>
  );
}
