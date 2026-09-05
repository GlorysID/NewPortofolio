"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * SwipeHint — petunjuk tipis bottom-center: "GESER UNTUK MENJELAJAH".
 *
 * - Tampil HANYA di konteks yang relevan: hero + papan tertutup +
 *   enter gate sudah dilewati (event `gate:dismissed`; fallback: body
 *   tidak lagi scroll-locked saat mount — HMR/remount aman).
 * - GSAP fade-in 0.8s (delay 1.2s hanya untuk penampilan pertama
 *   setelah gate), fade-out 0.3s saat menyembunyikan.
 * - Muncul di bawah enter gate (z-30 < z-40) — saat gate masih up,
 *   hint tertutup rapat.
 * - Murni petunjuk: pointer-events-none, aria-hidden.
 */
export default function SwipeHint() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const activeSection = useScrollStore((s) => s.activeSection);
  const textRef = useRef<HTMLParagraphElement>(null);
  const firstShow = useRef(true);
  const [gateDismissed, setGateDismissed] = useState(false);

  // Gate dilewati → event dari LoadingScreen. Fallback mount ulang:
  // body tak lagi scroll-locked berarti gate sudah tidak menutup.
  useEffect(() => {
    const onDismissed = () => setGateDismissed(true);
    window.addEventListener("gate:dismissed", onDismissed);
    if (document.body.style.overflow !== "hidden") setGateDismissed(true);
    return () =>
      window.removeEventListener("gate:dismissed", onDismissed);
  }, []);

  // Tampil/sembunyi mengikuti konteks
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const show =
      gateDismissed && !boardOpen && activeSection === "hero";
    gsap.killTweensOf(el);
    if (show) {
      const delay = firstShow.current ? 1.2 : 0;
      firstShow.current = false;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.8, delay, ease: "power2.out" },
      );
    } else {
      gsap.to(el, { autoAlpha: 0, duration: 0.3, ease: "power2.out" });
    }
  }, [gateDismissed, boardOpen, activeSection]);

  // Pusat horizontal via inset-x-0 + flex (bukan translate) — transform
  // bebas konflik dengan tween GSAP (y) di elemen yang sama.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center">
      <p
        ref={textRef}
        aria-hidden
        className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 opacity-0"
      >
        Geser kanan untuk melihat project
      </p>
    </div>
  );
}
