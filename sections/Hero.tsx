"use client";

import { useScrollStore } from "@/store/useScrollStore";

/**
 * Hero — copy-heavy poster stack (revisi).
 *
 * Baris ruled meta atas/bawah pindah ke FrameOverlay (fixed).
 * Di sini tinggal stack display raksasa — Avermont House hanya
 * untuk teks utama; semua teks section lain font normal.
 *
 * Saat kamera menoleh ke chalkboard (boardOpen), teks nama
 * crossfade menjadi "Project" besar — konteks proyek aktif.
 */
export default function Hero() {
  const boardOpen = useScrollStore((s) => s.boardOpen);

  return (
    <section
      id="hero"
      className="relative flex h-screen w-full flex-col items-start justify-center px-6 sm:px-12"
    >
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.45em] text-accent">
        Software Engineer
      </p>
      <h1 className="relative font-display text-[19vw] leading-[0.82] tracking-[-0.01em] text-text sm:text-[13vw] lg:text-[10.5vw]">
        {/* Crossfade nama ↔ "Project": dua lapis di kotak yang sama,
            opacity ditukar — tanpa layout shift. */}
        <span
          aria-hidden={boardOpen}
          className={`block transition-opacity duration-500 ${
            boardOpen ? "opacity-0" : "opacity-100"
          }`}
        >
          Anjali
          <br />
          Saputra
        </span>
        <span
          aria-hidden={!boardOpen}
          className={`absolute inset-0 transition-opacity duration-500 ${
            boardOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          Project
        </span>
      </h1>
      <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-muted sm:text-[15px]">
        Membangun program perangkat lunak dengan seni dan membantu banyak orang
      </p>
    </section>
  );
}
