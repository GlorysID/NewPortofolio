"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SHOTS } from "@/data/shots";
import { useScrollStore, type SectionId } from "@/store/useScrollStore";
import { boardDrag } from "@/lib/boardDrag";

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

            // Mapping section berbasis POSISI AKTUAL dari DOM — tinggi
            // section tidak seragam (Sertifikat > 1 viewport), formula
            // rata membuat Contact ter-skip ke Sertifikat. Fallback rata
            // bila section belum ter-mount.
            const tops = cachedTops;
            let section: string;
            if (tops) {
              const scrollY = self.progress * maxScroll();
              section = "hero";
              for (let i = 0; i < tops.length; i++) {
                if (scrollY >= tops[i]) section = SHOTS[i]?.id ?? "hero";
              }
            } else {
              const index = Math.round(
                self.progress * (SECTION_COUNT - 1)
              );
              section = SHOTS[index]?.id ?? "hero";
            }
            if (section !== lastActive) {
              lastActive = section;
              setActiveSection(section as SectionId);
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

    // ------------------------------------------------------------------
    // Posisi section AKTUAL dari DOM — dipakai snap & mapping section.
    // Penting: tinggi section tidak seragam (Sertifikat lebih tinggi
    // dari satu viewport karena grid 8 sertifikat) — formula rata
    // (index/(N-1) × maxScroll) membuat Contact ter-skip ke Sertifikat.
    // ------------------------------------------------------------------
    const getSectionTops = (): number[] | null => {
      const tops: number[] = [];
      for (const s of SHOTS) {
        const el = document.getElementById(s.id);
        if (!el) return null; // section belum ter-mount — fallback rata
        tops.push(el.getBoundingClientRect().top + window.scrollY);
      }
      return tops;
    };
    let cachedTops: number[] | null = null;
    const refreshTops = () => {
      cachedTops = getSectionTops();
    };
    // Refresh awal (setelah mount + font) & saat ukuran berubah.
    requestAnimationFrame(refreshTops);
    window.addEventListener("resize", refreshTops);
    window.addEventListener("load", refreshTops);
    window.addEventListener("chalkboard:papers", refreshTops);

    const scrollToSection = (index: number) => {
      const clamped = Math.max(0, Math.min(SECTION_COUNT - 1, index));
      // Ukur fresh saat gesture (murah, 6 query) — selalu akurat.
      const tops = getSectionTops();
      const top = tops
        ? Math.min(tops[clamped] ?? 0, maxScroll())
        : (clamped / (SECTION_COUNT - 1)) * maxScroll();
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
      // Ukur fresh — akurat walau tinggi section berubah sejak mount.
      const tops = getSectionTops();
      if (!tops) return; // fallback rata di onUpdate — jarang terjadi
      const y = window.scrollY;
      let current = 0;
      tops.forEach((t, i) => {
        if (y >= t) current = i;
      });
      scrollToSection(current + Math.sign(direction));
    };

    const isLocked = () =>
      locked || (snapTween !== null && snapTween.isActive()) ||
      performance.now() < cooldownUntil;

    // Wheel — { passive: false }. Aturan GERAK (keras):
    // - Board TERBUKA     → wheel diserap; geser kiri = staged exit
    //   (inspeksi → pan → tutup). Vertikal saat inspeksi = keluar.
    // - Cert wall TERBUKA → wheel diserap; geser KANAN = staged exit
    //   (mirror: dinding di kiri). Vertikal saat inspeksi = keluar.
    // - Keduanya tertutup → horizontal di HERO: kanan = board, kiri =
    //   cert wall. Vertikal = snap section.
    const onWheel = (e: WheelEvent) => {
      const { boardOpen, activeSection, boardInspect, setBoardInspect } =
        useScrollStore.getState();
      const horizontal =
        Math.abs(e.deltaX) >= BOARD_WHEEL_THRESHOLD &&
        Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (boardOpen) {
        e.preventDefault();
        if (horizontal && e.deltaX < 0) {
          // Geser kiri bertahap: inspeksi → pan normal → tutup papan.
          if (boardInspect) setBoardInspect(false);
          else setBoardOpen(false);
        } else if (!horizontal && boardInspect) {
          // Vertikal saat inspeksi = keluar inspeksi (tanpa snap).
          setBoardInspect(false);
        }
        return;
      }
      if (horizontal) {
        if (activeSection === "hero") {
          e.preventDefault();
          if (e.deltaX > 0) setBoardOpen(true); // kanan = board
        }
        return; // di luar hero: benar-benar diabaikan
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
      const dy = touchStartY - t.clientY; // geser ke atas → dy positif
      const dx = touchStartX === null ? 0 : t.clientX - touchStartX;
      const axis = touchAxis;
      touchStartY = null;
      touchStartX = null;
      touchAxis = null;

      const { boardOpen, activeSection, boardInspect, setBoardInspect } =
        useScrollStore.getState();
      const horizontal =
        axis === "x" &&
        Math.abs(dx) >= TOUCH_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * 1.2;

      // Drag-pan inspeksi baru selesai → event ini adalah akhir pan,
      // bukan gesture keluar. BACA SAJA — jangan reset di sini: flag
      // juga dibaca resolver klik SETELAH touchend (click event
      // menyusul touchend); reset dilakukan pointerdown berikutnya.
      if (boardDrag.moved) {
        return;
      }

      // Board TERBUKA (prioritas): staged exit ke kiri; vertikal saat
      // inspeksi = keluar inspeksi.
      if (boardOpen) {
        if (horizontal && dx < 0 && !isLocked()) {
          if (boardInspect) setBoardInspect(false);
          else setBoardOpen(false);
        } else if (!horizontal && boardInspect) {
          setBoardInspect(false);
        }
        return;
      }
      // Papan tertutup: horizontal di HERO — kanan = board. Di luar
      // hero: diabaikan.
      if (horizontal) {
        if (activeSection === "hero" && !isLocked()) {
          if (dx > 0) setBoardOpen(true);
        }
        return;
      }
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      if (isLocked()) return;
      snapAdjacent(dy);
    };

    // Keyboard — navigasi section + board eksklusif.
    const onKeyDown = (e: KeyboardEvent) => {
      const { activeSection, boardOpen, boardInspect, setBoardInspect } =
        useScrollStore.getState();
      switch (e.key) {
        case "Escape": {
          // Bertahap: quest/overlay window → inspeksi → pan normal.
          const st = useScrollStore.getState();
          if (st.activeProjectId) st.setActiveProjectId(null);
          else if (st.boardInspect) st.setBoardInspect(false);
          break;
        }
        case "ArrowRight":
          e.preventDefault();
          if (activeSection === "hero" && !boardOpen && !isLocked()) {
            setBoardOpen(true);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (boardOpen) {
            if (boardInspect) setBoardInspect(false);
            else setBoardOpen(false);
          }
          break;
        case "ArrowDown":
        case "PageDown":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          if (boardInspect) {
            setBoardInspect(false); // vertikal = keluar inspeksi
            break;
          }
          if (boardOpen) break; // TIDAK TERJADI APA PUN
          if (!isLocked())
            snapAdjacent(
              e.key === "ArrowDown" || e.key === "PageDown" ? 1 : -1
            );
          break;
        case "Home":
          e.preventDefault();
          if (!boardOpen && !isLocked()) scrollToSection(0);
          break;
        case "End": {
          e.preventDefault();
          if (!boardOpen && !isLocked())
            scrollToSection(SECTION_COUNT - 1);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    // Refresh setelah font/layout stabil agar ukuran trigger akurat —
    // sekalian segarkan posisi section (tops) untuk mapping aktif.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      refreshTops();
    });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", refreshTops);
      window.removeEventListener("load", refreshTops);
      window.removeEventListener("chalkboard:papers", refreshTops);
      snapTween?.kill();
      cancelAnimationFrame(raf);
      if (progressRaf) cancelAnimationFrame(progressRaf);
      ctx.revert(); // kill trigger + tween
    };
  }, []);

  return null;
}
