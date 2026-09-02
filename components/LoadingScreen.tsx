"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useProgress } from "@react-three/drei";
import { primeCameraAudio } from "@/hooks/useAudioUnlock";

/**
 * LoadingScreen — gerbang masuk dua fase di atas hitam polos (enter gate).
 *
 * Fase LOADING: satu baris teks body "Memuat pengalaman… 47%" — persentase
 * dari useProgress drei (zustand global, valid di luar Canvas). Tanpa bar,
 * tanpa tipografi display, tanpa dekorasi.
 *
 * Fase ENTER: begitu semua asset selesai (progress ≥ 100 & idle), teks
 * loading crossfade (~300ms) ke ajakan masuk "Klik untuk mulai" + sub-hint
 * suara. SELURUH overlay menjadi satu tombol: klik / Enter / Space adalah
 * user activation sesungguhnya → primeCameraAudio() dipanggil DI DALAM
 * gesture itu → audio shutter ter-unlock permanen sejak awal pengalaman
 * (policy autoplay memang hanya menghitung klik/keydown/touchend —
 * dengan gerbang ini aktivasi wajib itu menjadi aksi "masuk studio",
 * bukan interupsi).
 *
 * Setelah masuk: fade 500ms (pola dismiss lama) lalu overlay tidur dalam
 * keadaan opacity-0 + pointer-events-none. Scroll body dikunci selama
 * gerbang tampil (loading/enter/leaving) — wheel-snap tidak menggerakkan
 * halaman di balik gerbang; dilepas saat dismiss & saat unmount.
 *
 * Scene 3D tetap mount di balik gerbang (overlay z-40 murni visual) —
 * first paint & performa tidak berubah.
 */

type GatePhase = "loading" | "enter" | "leaving" | "gone";

export default function LoadingScreen() {
  const { active, progress } = useProgress();
  const [phase, setPhase] = useState<GatePhase>(
    progress >= 100 ? "enter" : "loading",
  );

  // LOADING → ENTER begitu useProgress selesai (semua asset termuat).
  useEffect(() => {
    if (phase === "loading" && !active && progress >= 100) {
      setPhase("enter");
    }
  }, [active, progress, phase]);

  /** Masuk: unlock audio DI DALAM gesture (klik/Enter/Space), lalu fade. */
  const enterExperience = useCallback(() => {
    // Guard: hanya dari fase enter — klik ganda / key repeat aman.
    setPhase((p) => {
      if (p !== "enter") return p;
      return "leaving";
    });
    primeCameraAudio();
    // Sinkron animasi masuk halaman utama dengan fade gerbang: hero
    // mendengarkan event ini dan menganimasikan teksnya masuk bersamaan.
    window.dispatchEvent(new Event("gate:dismissed"));
    // Jendela berat: fade gerbang full-screen di atas canvas WebGL.
    // FlashRegress (dpr turun) + ReflectorGate (reflektor pause ±700ms)
    // sudah mendengarkan event ini — mitighasi perf identik dengan
    // momen shutter, supaya fade tidak penuh frame-drop.
    window.dispatchEvent(new Event("camera-flash:begin"));
    // Lepaskan fokus dari gerbang sebelum overlay memudar + aria-hidden
    // (hindari fokus menggantung pada elemen yang hilang dari a11y tree).
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // LEAVING → GONE: tunggu fade selesai SEBELUM unmount (fade dulu,
  // baru bongkar dari DOM — potongan hitam terjadi kalau unmount
  // mencapai frame sebelum transisi opacity sempat jalan).
  useEffect(() => {
    if (phase !== "leaving") return;
    // 780ms ≈ durasi fade 750ms + buffer satu frame
    const t = setTimeout(() => setPhase("gone"), 780);
    return () => clearTimeout(t);
  }, [phase]);

  // Scroll lock selama gerbang tampil (loading & enter & leaving).
  // Restore otomatis saat dismiss (phase → gone) maupun saat unmount.
  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Keyboard: Enter/Space memicu masuk — keydown adalah user activation,
  // jadi pengguna keyboard mendapat audio juga.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enterExperience();
    }
  };

  const show = phase === "loading" || phase === "enter";
  const isEnter = phase === "enter";
  // Teks "Klik untuk mulai" tetap tampil selama fase leaving (fade
  // keluar) — jangan crossfade balik ke teks loading saat memudar.
  const enterVisible = phase === "enter" || phase === "leaving";

  // Fase "gone" → overlay DIBONGKAR dari DOM (bukan cuma opacity-0):
  // tidak ada lagi layer fullscreen dorman yang menggantung seumur
  // sesi — satu biaya komposit permanen hilang, FPS lebih stabil.
  // (Fade benar-benar terjadi di fase "leaving": show=false → opacity
  // transisi 650ms; unmount BARU setelah fade selesai.)
  if (phase === "gone") return null;

  return (
    <div
      data-gate="true"
      // Loading = region status; Enter = seluruh overlay jadi tombol.
      role={isEnter ? "button" : "status"}
      aria-live={isEnter ? undefined : "polite"}
      aria-label={isEnter ? "Mulai pengalaman dengan suara" : undefined}
      tabIndex={isEnter ? 0 : undefined}
      onClick={isEnter ? enterExperience : undefined}
      onKeyDown={isEnter ? onKeyDown : undefined}
      aria-hidden={!show}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black transition-[opacity,transform] duration-[750ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        show
          ? "opacity-100 scale-100"
          : "pointer-events-none opacity-0 scale-[1.04]"
      } ${isEnter ? "cursor-pointer select-none" : ""}`}
    >
      {/* Dua lapis teks yang ber-crossfade (~300ms). Lapisan loading
          tetap di alur (penentu ukuran wrapper) supaya posisi tengah
          stabil; lapisan enter diposisikan absolut di atasnya. Teks
          bukan target klik — overlay-lah tombolnya. */}
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
          <p className="whitespace-nowrap font-body text-base text-white/85">Klik untuk mulai</p>
        </div>
      </div>
    </div>
  );
}
