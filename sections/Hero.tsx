"use client";

import { useEffect, useState } from "react";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * Hero — copy-heavy poster stack.
 *
 * - Avermont House hanya untuk teks utama; teks section lain normal.
 * - Masuk halaman: mendengarkan `gate:dismissed` (dari LoadingScreen)
 *   → label/judul/deskripsi menganimasikan diri masuk (fade + naik,
 *   stagger 90ms) BERSAMAAN dengan fade gerbang — transisi terasa satu
 *   gerakan. Fallback 2.5s kalau gerbang tak pernah muncul.
 * - Saat kamera menoleh ke chalkboard (boardOpen): seluruh teks hero
 *   fade out, judul crossfade menjadi "My Project" besar.
 * - prefers-reduced-motion → tampil langsung tanpa transisi.
 */
export default function Hero() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const [entered, setEntered] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Sinkron dengan gerbang + fallback kalau gerbang tak pernah tampil.
  useEffect(() => {
    const onDismissed = () => setEntered(true);
    window.addEventListener("gate:dismissed", onDismissed);
    const fallback = window.setTimeout(() => setEntered(true), 2500);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("gate:dismissed", onDismissed);
      window.clearTimeout(fallback);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  // State tampil per elemen: papan terbuka → fade out (tanpa gerak);
  // belum masuk → tersembunyi + turun 12px; masuk → tampil. Stagger
  // via inline style (class dinamis tak ter-generate Tailwind).
  const stateOf = (stagger: number) => {
    if (boardOpen) return { cls: "opacity-0", delay: stagger };
    return entered
      ? { cls: "opacity-100 translate-y-0", delay: stagger }
      : { cls: "opacity-0 translate-y-3", delay: stagger };
  };

  const label = stateOf(0);
  const title = stateOf(90);
  const para = stateOf(180);
  const motion = reduced
    ? "duration-0"
    : "duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

  return (
    <section
      id="hero"
      className="relative flex h-screen w-full flex-col items-start justify-center px-6 sm:px-12"
    >
      <p
        aria-hidden={boardOpen}
        style={{ transitionDelay: `${label.delay}ms` }}
        className={`font-mono text-[11px] uppercase tracking-[0.45em] text-accent transition-[opacity,transform] ${motion} ${label.cls}`}
      >
        Software Engineer
      </p>
      <h1
        style={{ transitionDelay: `${title.delay}ms` }}
        className={`relative font-display text-[19vw] leading-[0.82] tracking-[-0.01em] text-text transition-[opacity,transform] ${motion} ${title.cls} sm:text-[13vw] lg:text-[10.5vw]`}
      >
        {/* Crossfade nama ↔ "My Project": dua lapis di kotak yang sama,
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
          My Project
        </span>
      </h1>
      <p
        aria-hidden={boardOpen}
        style={{ transitionDelay: `${para.delay}ms` }}
        className={`mt-5 max-w-md font-body text-sm leading-relaxed text-muted transition-[opacity,transform] ${motion} ${para.cls} sm:text-[15px]`}
      >
        Membangun program perangkat lunak dengan seni dan membantu banyak orang
      </p>
    </section>
  );
}
