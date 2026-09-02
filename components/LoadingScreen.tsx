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
    // 680ms ≈ durasi fade 650ms + buffer satu frame
    const t = setTimeout(() => setPhase("gone"), 680);
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
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      } ${isEnter ? "cursor-pointer select-none" : ""}`}
    >
      {/* Dua lapis teks yang ber-crossfade (~300ms). Lapisan loading
          tetap di alur (penentu ukuran wrapper) supaya posisi tengah
          stabil; lapisan enter diposisikan absolut di atasnya. Teks
          bukan target klik — overlay-lah tombolnya. */}
      <div className="pointer-events-none relative">
        <p
          aria-hidden={isEnter}
          className={`font-body text-sm tabular-nums text-white/85 transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            isEnter ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          Memuat pengalaman… {Math.round(progress)}%
        </p>
        <div
          aria-hidden={!isEnter}
          className={`absolute inset-0 flex flex-col items-center justify-center transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
            isEnter ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          <p className="whitespace-nowrap font-body text-base text-white/85">Klik untuk mulai</p>
          <p className="mt-2 whitespace-nowrap font-body text-xs text-white/50">
            Suara kamera aktif saat masuk
          </p>
        </div>
      </div>
    </div>
  );
}
