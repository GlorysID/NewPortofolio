"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useScrollStore, type SectionId } from "@/store/useScrollStore";
import { playCameraShutter, useAudioUnlock } from "@/hooks/useAudioUnlock";

/**
 * CameraFlash — kilatan kamera full-viewport + suara shutter.
 *
 * Trigger: subscribe ke useScrollStore — tiap activeSection BERGANTI
 * ke section yang punya kartu (bukan initial load, karena nilai awal
 * "hero" tidak punya kartu) → flash + click.
 *
 * - Overlay putih solid untuk seluruh app: flash baru me-restart
 *   timeline gsap yang sama (kill dulu) → scroll cepat antar section
 *   tidak menumpuk kilatan.
 * - Layer pre-promoted (will-change: opacity + translateZ(0)):
 *   layer + paint terjadi SEKALI saat mount, per-frame hanya compositing.
 * - Transform/opacity saja; pointer-events-none & aria-hidden.
 * - prefers-reduced-motion → tanpa suara, kilat cukup fade lembut.
 *
 * Audio: satu elemen <audio> bersama (`/audio/camera-flash.mp3`,
 * volume 0.6) dibuat + di-load EAGER saat mount (useAudioUnlock —
 * loading audio tidak dibatasi autoplay policy), di-warm-up pada
 * gesture pertama; attempt yang gagal karena policy di-retry otomatis
 * pada gesture berikutnya. Setiap section change me-restart elemen
 * yang sama — bebas race.
 *
 * UNLOCK UTAMA kini lewat enter gate di LoadingScreen: klik/Enter/
 * "Klik untuk mulai" memanggil primeCameraAudio() di dalam gesture
 * (activasi sesungguhnya) → audio aktif permanen sejak awal. Listener
 * gesture pasif di useAudioUnlock tetap sebagai jaring pengaman
 * (retry/flush attempt yang tertunda). Hint bottom-center lama
 * ("Klik di mana saja untuk suara kamera") dihapus — gerbang
 * menggantikannya.
 *
 * Saat flash, event `camera-flash:begin` di-dispatch ke window —
 * Experience memakainya untuk `performance.regress()` sementara
 * (menurunkan dpr via AdaptiveDpr; layar nyaris putih di puncak
 * kilatan, jadi penurunan resolusi tidak terlihat).
 */

const CARD_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  "about",
  "skills",
  "projects",
  "contact",
]);

export default function CameraFlash() {
  const flashRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Eager-load mp3 di mount + warm-up/fallback gesture pasif
  // (unlock utama: enter gate di LoadingScreen).
  useAudioUnlock();

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const unsubscribe = useScrollStore.subscribe((state, prev) => {
      if (state.activeSection === prev.activeSection) return;
      if (!CARD_SECTIONS.has(state.activeSection)) return;

      // Sinyal ke scene 3D: murahkan render selama jendela kilatan
      // (regress → dpr turun sementara via AdaptiveDpr, auto-recover).
      window.dispatchEvent(new CustomEvent("camera-flash:begin"));

      // Suara — no-op senyap bila gesture policy masih memblokir;
      // attempt di-retry otomatis pada gesture berikutnya.
      if (!reduced) playCameraShutter();

      const flash = flashRef.current;
      if (!flash) return;

      // Restart satu timeline — tidak pernah menumpuk.
      tlRef.current?.kill();
      const tl = gsap
        .timeline()
        .set(flash, { opacity: 0 })
        .to(flash, {
          opacity: 1,
          duration: reduced ? 0.2 : 0.08, // snap-in cepat
          ease: "power2.in",
        })
        .to(flash, {
          opacity: 0,
          duration: reduced ? 0.4 : 0.3, // fade-out realistis
          ease: "power2.out",
        });
      tlRef.current = tl;
    });

    return () => {
      unsubscribe();
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, []);

  return (
    <div
      ref={flashRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[35] opacity-0"
      style={{
        // Putih solid — texture kecil, murah di-VRAM; identik secara
        // visual selama snap 0.08s.
        background: "rgb(255 255 253)",
        // Pre-promote: layer + paint sekali di mount, bukan per flash.
        willChange: "opacity",
        transform: "translateZ(0)",
      }}
    />
  );
}
