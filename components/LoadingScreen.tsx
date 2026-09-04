"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import { primeCameraAudio } from "@/hooks/useAudioUnlock";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * LoadingScreen — gerbang masuk dua fase di atas hitam polos.
 *
 * Transisi keluar DIGERAKKAN GSAP (bukan transisi CSS Tailwind):
 * deterministik, inline style, tak terpengaruh kondisi generate class.
 * Klik → GSAP men-fade + scale overlay (iris-out 0.75s) → onComplete
 * baru overlay dibongkar dari DOM. Event `gate:dismissed` disinkronkan
 * untuk animasi masuk Hero; `camera-flash:begin` untuk jendela GPU.
 */

type GatePhase = "loading" | "enter" | "leaving" | "gone";

export default function LoadingScreen() {
  const { active, progress } = useProgress();
  const [phase, setPhase] = useState<GatePhase>(
    progress >= 100 ? "enter" : "loading",
  );
  const gateRef = useRef<HTMLDivElement>(null);

  // LOADING → ENTER begitu useProgress selesai (semua asset termuat).
  useEffect(() => {
    if (phase === "loading" && !active && progress >= 100) {
      setPhase("enter");
    }
  }, [active, progress, phase]);

  /** Masuk: unlock audio DI DALAM gesture, lalu GSAP iris-out overlay. */
  const enterExperience = useCallback(() => {
    setPhase((p) => {
      if (p !== "enter") return p;
      return "leaving";
    });
    primeCameraAudio();
    // Rendering scene dilanjutkan PERSIS saat fade mulai (gerbang masih
    // menutupi 100% layar sebelum titik ini → GPU tidak buang-buang
    // frame di balik overlay hitam).
    useScrollStore.getState().setGateUp(false);
    // Sinkron animasi masuk Hero + jendela GPU murah (reflektor pause,
    // dpr turun — sama seperti momen shutter).
    window.dispatchEvent(new Event("gate:dismissed"));
    window.dispatchEvent(new Event("camera-flash:begin"));
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // GSAP menggerakkan fade — onComplete baru unmount dari DOM.
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

  // Scroll lock selama gerbang tampil (loading/enter/leaving).
  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Gerbang menutupi layar → tandai scene agar berhenti render
  // (frameloop "never" di Experience) sampai fade dimulai.
  useEffect(() => {
    useScrollStore.getState().setGateUp(phase !== "gone");
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
  // Teks "Klik untuk mulai" tetap tampil selama leaving (fade keluar).
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
      {/* Dua lapis teks crossfade (CSS kecil, bukan jalur kritis). */}
      <div className="pointer-events-none relative">
        <p
          aria-hidden={enterVisible}
          className={`font-body text-sm tabular-nums text-white/85 transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            enterVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          Memuat pengalaman… {Math.round(progress)}%
        </p>
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
