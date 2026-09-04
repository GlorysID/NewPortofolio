"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import { primeCameraAudio } from "@/hooks/useAudioUnlock";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * LoadingScreen — gerbang masuk dengan progres yang JUJUR, tiga fase:
 *
 * 1. LOADING  — "Memuat pengalaman… X%" (drei useProgress: unduhan
 *    + decode aset). Selesai → tandai assetsLoaded di store.
 * 2. WARMING  — "Menyiapkan panggung…" (kompilasi shader pertama,
 *    bake bayangan, 8 frame warm-up di dalam Canvas). Selama fase ini
 *    pekerjaan berat GPU berlangsung DI BALIK gerbang — bukan lagi
 *    saat klik. Selesai → sceneReady.
 * 3. ENTER    — "Klik untuk mulai" muncul HANYA setelah sceneReady:
 *    klik = murni komposit + GSAP iris-out, tanpa pekerjaan berat.
 *
 * Transisi keluar digerakkan GSAP (bukan CSS): klik → iris-out 0.75s
 * → onComplete unmount. `gate:dismissed` disinkronkan ±60ms untuk
 * animasi masuk Hero.
 */

type GatePhase = "loading" | "warming" | "enter" | "leaving" | "gone";

export default function LoadingScreen() {
  const { active, progress } = useProgress();
  const sceneReady = useScrollStore((s) => s.sceneReady);
  const [phase, setPhase] = useState<GatePhase>("loading");
  const gateRef = useRef<HTMLDivElement>(null);

  // 1. Aset selesai → tandai + masuk fase warming.
  useEffect(() => {
    if (phase === "loading" && !active && progress >= 100) {
      useScrollStore.getState().setAssetsLoaded(true);
      setPhase("warming");
    }
  }, [active, progress, phase]);

  // 2. Scene hangat (shader + bayangan + frame warm-up selesai) → enter.
  useEffect(() => {
    if (phase === "warming" && sceneReady) setPhase("enter");
  }, [sceneReady, phase]);

  /** Masuk: unlock audio DI DALAM gesture, GSAP iris-out overlay. */
  const enterExperience = useCallback(() => {
    setPhase((p) => {
      if (p !== "enter") return p;
      return "leaving";
    });
    primeCameraAudio();
    // Sinkron animasi masuk Hero ±60ms setelah tween mulai — frame
    // pertama fade murni komposit (tidak ada pekerjaan berat lain).
    window.setTimeout(
      () => window.dispatchEvent(new Event("gate:dismissed")),
      60,
    );
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const el = gateRef.current;
    if (el) {
      gsap.set(el, { pointerEvents: "none" });
      gsap.to(el, {
        opacity: 0,
        scale: 1.05,
        transformOrigin: "50% 45%",
        duration: 0.75,
        ease: "power2.inOut",
        onComplete: () => setPhase("gone"),
      });
    } else {
      setPhase("gone");
    }
  }, []);

  // Scroll lock selama gerbang tampil.
  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Keyboard: Enter/Space memicu masuk.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enterExperience();
    }
  };

  // Fase "gone" → overlay DIBONGKAR dari DOM.
  if (phase === "gone") return null;

  const isEnter = phase === "enter";
  const enterVisible = phase === "enter" || phase === "leaving";

  return (
    <div
      ref={gateRef}
      data-gate="true"
      role={isEnter ? "button" : "status"}
      aria-live={isEnter ? undefined : "polite"}
      aria-label={isEnter ? "Mulai pengalaman dengan suara" : undefined}
      tabIndex={isEnter ? 0 : undefined}
      onClick={isEnter ? enterExperience : undefined}
      onKeyDown={isEnter ? onKeyDown : undefined}
      aria-hidden={phase === "leaving"}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black ${
        isEnter ? "cursor-pointer select-none" : ""
      }`}
    >
      {/* Tiga lapis teks crossfade per fase (CSS kecil, bukan jalur
          kritis — transisi kritis ada di GSAP). */}
      <div className="pointer-events-none relative">
        <p
          aria-hidden={phase !== "loading"}
          className={`font-body text-sm tabular-nums text-white/85 transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            phase === "loading" ? "opacity-100" : "-translate-y-1 opacity-0"
          }`}
        >
          Memuat pengalaman… {Math.round(progress)}%
        </p>
        <div
          aria-hidden={phase !== "warming"}
          className={`absolute inset-0 flex flex-col items-center justify-center transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            phase === "warming" ? "opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          <p className="whitespace-nowrap font-body text-base text-white/85">
            Menyiapkan panggung…
          </p>
        </div>
        <div
          aria-hidden={!enterVisible}
          className={`absolute inset-0 flex flex-col items-center justify-center transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            enterVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          <p className="whitespace-nowrap font-body text-base text-white/85">
            Klik untuk mulai
          </p>
        </div>
      </div>
    </div>
  );
}
