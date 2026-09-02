"use client";

import { useEffect } from "react";

/**
 * useAudioUnlock — elemen audio shutter kamera bersama + unlock gesture.
 *
 * SATU elemen `new Audio("/audio/camera-flash.mp3")`, di-cache di window
 * sepanjang tab, dibuat + di-`load()` EAGER saat mount (bukan lazy saat
 * flash pertama). Loading/fetch/decode audio TIDAK dibatasi autoplay
 * policy — hanya PLAY yang dibatasi — sehingga saat loading screen
 * selesai, mp3 sudah ter-fetch & ter-decode dan elemen siap instant-
 * play. Kilatan pertama tidak pernah kosong menunggu network.
 *
 * Browser memblokir play() programatik sebelum ada gesture user. Hook
 * ini memasang listener pasif (pointerdown/keydown/touchstart/touchend/
 * pointerup — touchend & pointerup penting untuk iOS) yang "menghangat-
 * kan" elemen: play singkat dalam keadaan mute lalu pause. Listener
 * tetap terpasang sampai unlock terkonfirmasi (di-detach pada gesture
 * berikutnya setelah `unlocked` true); kalau gesture belum dihitung
 * (mis. touchstart saja di Safari lama), gesture berikutnya mencoba lagi.
 *
 * Jaminan retry — attempt play tidak pernah hilang: bila
 * `playCameraShutter()` digagalkan policy (elemen belum unlock), attempt
 * itu dicatat dan DIPUTAR ULANG pada gesture berikutnya (real play di
 * dalam gesture = membuka unlock + memainkan suara sekaligus, tanpa
 * race muted warm-up). Warm-up juga diulang saat `visibilitychange →
 * visible` (tab bisa me-re-suspend audio policy). Scroll-only users
 * yang belum pernah klik tetap mendapatkan suara di klik pertama
 * berikutnya, bukan kehilangan suara selamanya.
 *
 * Selama policy gesture masih memblokir, play() gagal → no-op senyap
 * (catch kosong, tanpa console spam).
 */

/** Flag unlock — true begitu play() pernah berhasil (warm-up atau play nyata). */
let unlocked = false;

/**
 * Tandai unlock + umumkan ke konsumen UI (hint di CameraFlash) — event
 * window hanya ditembakkan pada transisi false → true, tepat sekali.
 */
function markUnlocked(): void {
  if (unlocked) return;
  unlocked = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("camera-audio:unlocked"));
  }
}

/**
 * Play shutter yang digagalkan policy (belum unlock) — di-retry pada
 * gesture berikutnya / saat tab kembali visible.
 */
let shutterPending = false;

type WindowWithCameraAudio = Window & {
  __cameraAudio?: HTMLAudioElement | null;
};

/** Elemen audio bersama — dibuat sekali, di-cache di window sepanjang tab. */
export function getCameraAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithCameraAudio;
  if (w.__cameraAudio === undefined) {
    try {
      const el = new Audio("/audio/camera-flash.mp3");
      el.preload = "auto";
      el.volume = 0.6; // modest
      w.__cameraAudio = el;
    } catch {
      w.__cameraAudio = null;
    }
  }
  return w.__cameraAudio;
}

/**
 * Eager init — WAJIB dipanggil di mount effect (client-only). Membuat
 * elemen + `load()` SEKARANG: fetch + decode berlangsung segera, jauh
 * sebelum kilatan pertama. `load()` TIDAK dibatasi autoplay policy
 * (yang dibatasi hanya play()) — aman dipanggil tanpa gesture.
 */
export function initCameraAudio(): void {
  const audio = getCameraAudio();
  if (!audio) return;
  if (audio.readyState === 0) audio.load();
}

/** Status unlock terkini (untuk state awal konsumen UI). */
export function isCameraAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * Warm-up saat gesture: play mute singkat lalu pause. Play yang
 * berhasil di dalam gesture membuka izin play programatik selamanya.
 */
export function primeCameraAudio(): void {
  const audio = getCameraAudio();
  if (!audio || unlocked) return;
  if (audio.readyState === 0) audio.load();
  if (!audio.paused) return; // warm-up sedang berjalan
  const settle = () => {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  };
  audio.muted = true;
  audio
    .play()
    .then(() => {
      markUnlocked();
      settle();
    })
    .catch(() => {
      // Belum unlock (gesture belum dihitung) — coba lagi di gesture
      // berikutnya; biarkan listener tetap terpasang.
      audio.muted = false;
    });
}

/**
 * Mainkan suara shutter: restart satu elemen bersama. Bila policy
 * gesture masih memblokir, play() gagal senyap — TAPI attempt dicatat
 * (`shutterPending`) dan diputar ulang otomatis pada gesture
 * berikutnya: tidak ada section-change yang kehilangan suara selamanya.
 */
export function playCameraShutter(): void {
  const audio = getCameraAudio();
  if (!audio) return;
  audio.currentTime = 0;
  audio
    .play()
    .then(() => {
      markUnlocked();
      // Attempt ini tuntas (entah itu attempt tertunda yang di-flush).
      shutterPending = false;
    })
    .catch(() => {
      // Policy masih memblokir → catat untuk retry pada gesture
      // berikutnya / visibilitychange (lihat useAudioUnlock).
      shutterPending = true;
    });
}

/** Retry guarantee: tuntaskan play shutter yang tertunda SEKARANG. */
function flushShutterPending(): void {
  if (!shutterPending) return;
  shutterPending = false;
  playCameraShutter();
}

/**
 * useAudioUnlock — eager-load audio di mount + pasang listener gesture
 * sekali sampai unlock terkonfirmasi. Upaya shutter yang tertunda
 * di-flush pada gesture berikutnya; warm-up diulang saat tab kembali
 * visible.
 */
export function useAudioUnlock(): void {
  useEffect(() => {
    // EAGER: buat elemen + mulai fetch/decode sejak mount — bukan saat
    // flash pertama. Loading audio tidak dibatasi autoplay policy.
    initCameraAudio();

    const events = [
      "pointerdown",
      "keydown",
      "touchstart",
      "touchend",
      "pointerup",
    ] as const;
    const opts: AddEventListenerOptions = { passive: true, capture: true };

    function detach() {
      events.forEach((e) => window.removeEventListener(e, onGesture, opts));
    }

    function onGesture() {
      // Ada play shutter yang tertunda? Tuntaskan SEKARANG — real play
      // di dalam gesture membuka unlock sekaligus memainkan suara.
      if (shutterPending) {
        flushShutterPending();
        return;
      }
      if (unlocked) {
        // Unlock sudah terkonfirmasi — listener baru boleh dilepas.
        detach();
        return;
      }
      primeCameraAudio();
    }

    // Tab yang kembali visible bisa me-re-suspend audio policy —
    // hangatkan ulang + tuntaskan attempt shutter yang tertunda.
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      primeCameraAudio();
      flushShutterPending();
    }

    events.forEach((e) => window.addEventListener(e, onGesture, opts));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      detach();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
