"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SHOTS } from "@/data/shots";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * ScrollProgressController — infrastruktur scroll GSAP.
 *
 * SATU trigger ScrollTrigger mode scrub yang mencakup seluruh
 * tinggi halaman (#main-scroll, start 'top top' → end 'bottom bottom').
 * Tween proxy 0→1 dengan scrub: 1 memetakan posisi scroll ke progress
 * (scrub = nilai selalu sinkron dengan scroll, bolak-balik).
 *
 * onUpdate:
 * - progress → store.setProgress() — di-throttle: maksimal SATU tulisan
 *   per requestAnimationFrame, dan dilewati bila delta < 0.001
 *   (micro-scroll tidak memicu notifikasi subscriber store).
 * - activeSection → index terdekat: round(progress × 4) → SHOTS[index]
 *   (tidak di-throttle — tetap ganti section seketika).
 *
 * Gesture snapping (fullpage-style, reaktif instan):
 * - Satu gestur (wheel / swipe / tombol keyboard) langsung memindahkan
 *   halaman ke section BERSEBELAHAN — tidak menunggu scroll idle
 *   seperti snap bawaan ScrollTrigger.
 * - Wheel: deltaY bermakna pertama (≥ WHEEL_THRESHOLD px) → snap.
 * - Touch: swipe vertikal ≥ TOUCH_THRESHOLD px (touchstart→touchend)
 *   → snap searah swipe.
 * - Keyboard: ArrowDown/ArrowUp, PageDown/PageUp → tetangga;
 *   Home/End → pertama/terakhir (semua preventDefault).
 * - Lock input selama animasi snap; setelah selesai, cooldown singkat
 *   untuk meredam momentum trackpad.
 * - prefers-reduced-motion: reduce → pindah instan tanpa animasi
 *   (window.scrollTo langsung), semua jalur input sama.
 *
 * Target scroll memakai rumus even-spacing: semua section h-screen
 * di dalam #main-scroll (window adalah scroller), sehingga posisi
 * section i = (i / (SECTION_COUNT - 1)) × maxScroll.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

const SECTION_COUNT = SHOTS.length; // 5 section

const WHEEL_THRESHOLD = 4; // px deltaY minimum — bunuh event phantom trackpad
const BOARD_WHEEL_THRESHOLD = 24; // px deltaX minimum — board open/close
const TOUCH_THRESHOLD = 40; // px swipe minimum (touchstart → touchend)
const SNAP_DURATION = 0.6; // detik per animasi snap
const COOLDOWN_MS = 250; // jeda setelah snap selesai sebelum menerima input lagi

export default function ScrollProgressController() {
  useEffect(() => {
    const { setProgress, setActiveSection, setBoardOpen } =
      useScrollStore.getState();
    let lastActive: string | null = null;
    let lastWritten = -1; // nilai progress terakhir yang benar-benar ditulis
    let pending: number | null = null;
    let progressRaf = 0;

    const flushProgress = () => {
      progressRaf = 0;
      if (pending === null) return;
      const p = pending;
      pending = null;
      // Tulis hanya bila delta terasa (≥0.001) atau tepat di boundary
      // 0/1 — visual identik (delta 0.001 = 0.1% halaman), hemat
      // re-render/notifikasi subscriber store.
      if (Math.abs(p - lastWritten) >= 0.001 || p <= 0 || p >= 1) {
        lastWritten = p;
        setProgress(p);
      }
    };

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Konfigurasi tambahan untuk ScrollTrigger — sekarang tanpa "snap":
    // snapping ditangani gesture snapper di bawah, bukan snap bawaan.
    const snapConfig = prefersReducedMotion ? {} : {};

    const ctx = gsap.context(() => {
      // Proxy tween — scrub sejati: nilai sinkron 1:1 dengan posisi scroll
      const proxy = { value: 0 };
      gsap.to(proxy, {
        value: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#main-scroll",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
          ...snapConfig,
          onUpdate: (self) => {
            // Throttle: simpan nilai, jadwalkan satu flush per rAF
            pending = self.progress;
            if (!progressRaf) {
              progressRaf = requestAnimationFrame(flushProgress);
            }

            const index = Math.round(self.progress * (SECTION_COUNT - 1));
            const section = SHOTS[index]?.id ?? "hero";
            if (section !== lastActive) {
              lastActive = section;
              setActiveSection(section);
              // Pindah section keluar hero → papan proyek otomatis tertutup.
              if (section !== "hero") setBoardOpen(false);
            }
          },
        },
      });
    });

    // ------------------------------------------------------------------
    // Gesture snapper — fullpage-style: satu gestur → snap ke section
    // bersebelahan. Window adalah scroller; #main-scroll adalah kontainer
    // tinggi (section h-screen bertumpuk). Scrub: 1 pada ScrollTrigger
    // menyerap lompatan sebagai damping kamera.
    // ------------------------------------------------------------------
    let locked = false; // true selama animasi snap berjalan
    let cooldownUntil = 0; // timestamp ms — setelah animasi, tunggu sejenak
    let snapTween: gsap.core.Tween | null = null;
    let touchStartY: number | null = null;
    let touchStartX: number | null = null;
    // Arah dominan gestur touch ("x" | "y" | null) — diputuskan sekali
    // di touchmove pertama yang bermakna: horizontal → board, vertikal → snap.
    let touchAxis: "x" | "y" | null = null;

    const maxScroll = () =>
      Math.max(
        0,
        (document.documentElement.scrollHeight ?? 0) - window.innerHeight
      );

    const scrollToSection = (index: number) => {
      const clamped = Math.max(0, Math.min(SECTION_COUNT - 1, index));
      const top = (clamped / (SECTION_COUNT - 1)) * maxScroll();
      if (prefersReducedMotion) {
        window.scrollTo(0, top);
        locked = false;
        cooldownUntil = performance.now() + COOLDOWN_MS;
        return;
      }
      locked = true;
      snapTween?.kill();
      snapTween = gsap.to(window, {
        duration: SNAP_DURATION,
        ease: "power2.inOut",
        scrollTo: { y: top, autoKill: false },
        onComplete: () => {
          locked = false;
          cooldownUntil = performance.now() + COOLDOWN_MS;
        },
      });
    };

    const snapAdjacent = (direction: number) => {
      const current = Math.round(
        (window.scrollY / Math.max(1, maxScroll())) * (SECTION_COUNT - 1)
      );
      scrollToSection(current + Math.sign(direction));
    };

    const isLocked = () =>
      locked || (snapTween !== null && snapTween.isActive()) ||
      performance.now() < cooldownUntil;

    // Wheel — { passive: false } agar preventDefault() menghentikan scroll
    // native begitu gestur bermakna terdeteksi.
    const onWheel = (e: WheelEvent) => {
      // Gestur horizontal (trackpad dua arah / shift+wheel): buka/tutup
      // papan proyek alih-alih snap vertikal. Ambang lebih tinggi dari
      // vertikal agar tidak salah picu saat gerak diagonal halus.
      if (
        Math.abs(e.deltaX) >= BOARD_WHEEL_THRESHOLD &&
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
      ) {
        e.preventDefault();
        setBoardOpen(e.deltaX > 0);
        return;
      }
      if (isLocked()) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return; // phantom trackpad
      e.preventDefault();
      snapAdjacent(e.deltaY);
    };

    // Touch — catat Y saat touchstart, nilai saat touchend menentukan swipe.
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartY = t ? t.clientY : null;
      touchStartX = t ? t.clientX : null;
      touchAxis = null; // arah dominan gestur belum diketahui
    };
    const onTouchMove = (e: TouchEvent) => {
      // Tentukan arah dominan sekali di gerak pertama yang bermakna:
      // horizontal → biarkan lewat (tanpa preventDefault) supaya gestur
      // sampai ke touchend; vertikal → halangi scroll native (snap
      // dikejar di touchend). Tidak ada scroll horizontal di halaman,
      // jadi melepas kunci horizontal aman.
      if (touchAxis === null) {
        const t = e.touches[0];
        if (t && touchStartX !== null && touchStartY !== null) {
          const dx = Math.abs(t.clientX - touchStartX);
          const dy = Math.abs(t.clientY - touchStartY);
          if (dx > 8 || dy > 8) {
            touchAxis = dx > dy ? "x" : "y";
          }
        }
      }
      if (touchAxis === "x") return;
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY === null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = touchStartY - t.clientY; // geser ke atas → deltaY positif
      const dx = touchStartX === null ? 0 : t.clientX - touchStartX;
      touchStartY = null;
      touchStartX = null;
      touchAxis = null;
      // Swipe horizontal dominan → buka/tutup papan proyek.
      if (
        Math.abs(dx) >= TOUCH_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * 1.2
      ) {
        if (!isLocked()) setBoardOpen(dx < 0); // geser kiri → buka
        return;
      }
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      if (isLocked()) return;
      snapAdjacent(dy);
    };

    // Keyboard — navigasi section eksplisit.
    const onKeyDown = (e: KeyboardEvent) => {
      const adjacent = () => {
        if (isLocked()) return;
        if (e.key === "ArrowDown" || e.key === "PageDown") snapAdjacent(1);
        else if (e.key === "ArrowUp" || e.key === "PageUp") snapAdjacent(-1);
      };
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          adjacent();
          break;
        case "Home":
          e.preventDefault();
          if (!isLocked()) scrollToSection(0);
          break;
        case "End":
          e.preventDefault();
          if (!isLocked()) scrollToSection(SECTION_COUNT - 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    // Refresh setelah font/layout stabil agar ukuran trigger akurat
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      snapTween?.kill();
      cancelAnimationFrame(raf);
      if (progressRaf) cancelAnimationFrame(progressRaf);
      ctx.revert(); // kill trigger + tween
    };
  }, []);

  return null;
}
