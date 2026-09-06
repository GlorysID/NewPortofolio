"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * Hero · copy-heavy poster stack.
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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const targets = [titleRef.current, paraRef.current];
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
    gsap.set([titleRef.current, paraRef.current], {
      autoAlpha: 0,
      y: 14,
    });
  }, []);

  return (
    <section
      id="hero"
      className="relative flex h-screen w-full flex-col items-start justify-center px-6 sm:px-12 [@media(max-width:1023px)_and_(orientation:portrait)]:items-start [@media(max-width:1023px)_and_(orientation:portrait)]:justify-end [@media(max-width:767px)]:pb-[calc(env(safe-area-inset-bottom)+9.6rem)] [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:pb-[calc(env(safe-area-inset-bottom)+7.8rem)]"
    >
      <h1
        ref={titleRef}
        className={`relative font-display text-[min(19vw,72px)] leading-[0.82] tracking-[-0.01em] text-text transition-opacity duration-500 sm:text-[13vw] lg:text-[10.5vw] [@media(max-width:767px)]:text-[clamp(2.9rem,14vw,4.2rem)] [@media(max-width:767px)]:leading-[0.86] [@media(max-width:767px)]:tracking-[-0.02em] [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:text-[min(14vw,62px)] ${
          boardInspect ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Crossfade nama ↔ "My Project": dua lapis di kotak yang sama,
            opacity ditukar · tanpa layout shift. */}
        <span
          aria-hidden={boardOpen}
          className={`block transition-opacity duration-500 drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] ${
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
          } [@media(max-width:1023px)_and_(orientation:portrait)]:fixed [@media(max-width:1023px)_and_(orientation:portrait)]:top-[calc(env(safe-area-inset-top)+2rem)] [@media(max-width:1023px)_and_(orientation:portrait)]:left-6 [@media(max-width:1023px)_and_(orientation:portrait)]:bottom-auto [@media(max-width:1023px)_and_(orientation:portrait)]:right-auto [@media(max-width:1023px)_and_(orientation:portrait)]:text-[clamp(2rem,8.5vw,2.8rem)]`}
        >
          My Project
        </span>
      </h1>
      <p
        ref={paraRef}
        aria-hidden={boardOpen}
        className={`mt-5 max-w-md font-body text-sm leading-relaxed text-muted transition-opacity duration-500 sm:text-[15px] [@media(max-width:767px)]:mt-3 [@media(max-width:767px)]:text-[13px] [@media(max-width:767px)]:leading-[1.5] [@media(max-width:767px)]:max-w-[28ch] [@media(max-width:767px)]:text-[#b0b0a8] ${
          boardOpen ? "opacity-0" : "opacity-100"
        }`}
      >
        <span className="hidden sm:inline">
          Membangun sistem yang cerdas, otomatis, dan mandiri, mengeksplorasi
          bagaimana AI dan otomasi bergabung menyelesaikan masalah nyata.
        </span>
        <span className="sm:hidden">
          Membangun sistem AI, otomasi, dan web yang cerdas & mandiri.
        </span>
      </p>
    </section>
  );
}
