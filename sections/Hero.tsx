"use client";

/**
 * Hero — copy-heavy poster stack (revisi).
 *
 * Baris ruled meta atas/bawah pindah ke FrameOverlay (fixed).
 * Di sini tinggal stack display raksasa — Avermont House hanya
 * untuk teks utama; semua teks section lain font normal.
 */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex h-screen w-full flex-col items-start justify-center px-6 sm:px-12"
    >
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.45em] text-accent">
        Software Engineer
      </p>
      <h1 className="font-display text-[19vw] leading-[0.82] tracking-[-0.01em] text-text sm:text-[13vw] lg:text-[10.5vw]">
        Anjali
        <br />
        Saputra
      </h1>
      <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-muted sm:text-[15px]">
        Membangun program perangkat lunak dengan seni dan membantu banyak orang
      </p>
    </section>
  );
}
