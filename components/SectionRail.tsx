"use client";

import { useScrollStore, type SectionId } from "@/store/useScrollStore";

/**
 * SectionRail — pengganti scrollbar native: lima garis tipis (satu per
 * section, urutan SHOTS), garis aktif memanjang & menyala accent.
 * Klik / Enter / Space (tombol native) = lompat ke section — formula
 * sama dengan gesture snapper: `index/4 × (scrollHeight − innerHeight)`.
 *
 * - Fixed kanan-tengah, z-30: di bawah enter gate LoadingScreen (z-40)
 *   dan di bawah kilatan kamera (z-[35]) — tidak menutupi keduanya.
 * - Selector Zustand sempit (`activeSection` saja) — re-render hanya
 *   saat section berganti, tidak per frame.
 * - Hit area tombol ≥ 24px (h-6 × w-10) meski garisnya cuma 2–3px.
 * - prefers-reduced-motion → lompatan instan (behavior "auto"), senada
 *   perilaku snapper.
 */

/** Urutan & label navigasi — hardcoded, urutan sama dengan SHOTS. */
const RAIL_SECTIONS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: "hero", label: "Ke Hero" },
  { id: "about", label: "Ke Tentang" },
  { id: "skills", label: "Ke Keahlian" },
  { id: "projects", label: "Ke Proyek" },
  { id: "contact", label: "Ke Kontak" },
];

export default function SectionRail() {
  const activeSection = useScrollStore((s) => s.activeSection);

  const jumpTo = (index: number) => {
    const max =
      document.documentElement.scrollHeight - window.innerHeight;
    const top = (index / (RAIL_SECTIONS.length - 1)) * max;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <nav
      aria-label="Navigasi section"
      className="fixed right-4 top-1/2 z-30 -translate-y-1/2 sm:right-6"
    >
      <ul className="flex flex-col items-center gap-[10px]">
        {RAIL_SECTIONS.map((section, index) => {
          const isActive = section.id === activeSection;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => jumpTo(index)}
                aria-label={section.label}
                aria-current={isActive ? "true" : undefined}
                className="group flex h-6 w-10 items-center justify-center outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 focus-visible:outline-offset-2"
              >
                {/* Garis — transisi width/height/background-color saja
                    (area piksel kecil; tanpa layout thrash yang terasa). */}
                <span
                  className={`rounded-full transition-[width,height,background-color] duration-300 ease-out ${
                    isActive
                      ? "h-[3px] w-10 bg-white"
                      : "h-[2px] w-6 bg-white/25 group-hover:bg-white/50"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
