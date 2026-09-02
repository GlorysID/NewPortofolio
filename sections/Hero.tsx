"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * Hero — copy-heavy poster stack.
 *
 * - Animasi masuk DIGERAKKAN GSAP (bukan transisi CSS Tailwind):
 *   mendengarkan `gate:dismissed` → label/judul/deskripsi naik masuk
 *   berjenjang (stagger 90ms). Fallback 3s kalau gerbang tak pernah
 *   muncul. reduced-motion → tampil langsung tanpa tween.
 * - Saat kamera menoleh ke chalkboard (boardOpen): label & deskripsi
 *   fade out via class, judul crossfade menjadi "My Project" (span).
 *   clearProps setelah entrance memastikan class kembali berkuasa.
 */
export default function Hero() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const boardInspect = useScrollStore((s) => s.boardInspect);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const targets = [labelRef.current, titleRef.current, paraRef.current];
    let ran = false;

    const runEntrance = () => {
      if (ran || targets.some((t) => !t)) return;
      ran = true;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        gsap.set(targets, { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.09,
          // Bersihkan inline style setelah selesai → class React
          // (fade boardOpen dsb.) kembali sepenuhnya berkuasa.
          clearProps: "all",
        },
      );
    };

    window.addEventListener("gate:dismissed", runEntrance);
    // Fallback: kalau gerbang tak pernah tampil, tetap masuk.
    const fallback = window.setTimeout(runEntrance, 3000);
    return () => {
      window.removeEventListener("gate:dismissed", runEntrance);
      window.clearTimeout(fallback);
    };
  }, []);

  // Sembunyikan sebelum entrance (pre-paint, di balik gerbang z-40).
  useEffect(() => {
    gsap.set([labelRef.current, titleRef.current, paraRef.current], {
      autoAlpha: 0,
      y: 14,
    });
  }, []);

  return (
    <section
      id="hero"
      className="relative flex h-screen w-full flex-col items-start justify-center px-6 sm:px-12"
    >
      <p
        ref={labelRef}
        aria-hidden={boardOpen}
        className={`mb-3 font-mono text-[11px] uppercase tracking-[0.45em] text-accent transition-opacity duration-500 ${
          boardOpen ? "opacity-0" : "opacity-100"
        }`}
      >
        Software Engineer
      </p>
      <h1
        ref={titleRef}
        className={`relative font-display text-[19vw] leading-[0.82] tracking-[-0.01em] text-text transition-opacity duration-500 sm:text-[13vw] lg:text-[10.5vw] ${
          boardInspect ? "opacity-0" : "opacity-100"
        }`}
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
        ref={paraRef}
        aria-hidden={boardOpen}
        className={`mt-5 max-w-md font-body text-sm leading-relaxed text-muted transition-opacity duration-500 sm:text-[15px] ${
          boardOpen ? "opacity-0" : "opacity-100"
        }`}
      >
        Membangun program perangkat lunak dengan seni dan membantu banyak orang
      </p>
    </section>
  );
}
