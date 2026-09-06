"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SHOTS } from "@/data/shots";
import { useScrollStore, type SectionId } from "@/store/useScrollStore";
import { boardDrag } from "@/lib/boardDrag";
import { MQ } from "@/hooks/useViewportTier";

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
 * - Wheel (round 6B, dua timestamp): lastRawWheelT diupdate di SEMUA
 *   event (drop termasuk); re-arm butuh raw stream tenang ≥180ms DAN
 *   lock tween+cooldown sudah berakhir. Kontrak: stream gap <180ms =
 *   SATU gestur selamanya (momentum tak pernah double-advance);
 *   pause ≥180ms pasca-lock = gestur baru (recovery cepat).
 * - Touch: swipe vertikal ≥ TOUCH_THRESHOLD px (touchstart→touchend)
 *   → snap searah swipe; swipe kedua selama lock DIBUANG (bukan
 *   diantrekan).
 * - Keyboard: ArrowDown/ArrowUp, PageDown/PageUp → tetangga;
 *   Home/End → pertama/terakhir (semua preventDefault, drop saat
 *   lock aktif — tanpa antrean).
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

const STEP_ACC_THRESHOLD = 25; // akumulasi |deltaY| per LANGKAH — trackpad pelan pun capai dalam 1–2 event; jitter jari diam (jendela lock) tak terkumpul secukupnya
const NOISE_FLOOR = 3; // event di bawah ini = derau mikro (jari menyentuh tanpa niat) — diabaikan total
const STREAM_GAP_RESET_MS = 200; // jeda antar-event > ini = stream input baru → accum dibuang (scroll terpisah tidak menjumlah)
const BOARD_WHEEL_THRESHOLD = 24; // px deltaX minimum — board open/close
const TOUCH_THRESHOLD = 48; // px swipe minimum (touchstart → touchend) — 40 terlalu sensitif utk intent user r6
const BOARD_SWIPE_MIN = 40; // px minimum khusus intent horizontal board — arc jempol sering <48px
const EDGE_ZONE_PX = 16; // zona tepi utk guard back/forward — 24 terlalu lebar, menelan swipe sah yang mulai dekat tepi
const SNAP_DURATION = 0.6; // detik per animasi snap
const COOLDOWN_MS = 250; // jeda setelah snap selesai sebelum menerima input lagi
const FLICK_EXIT_DX = 64; // px geser kiri minimum — flick keluar inspeksi (coarse)

export default function ScrollProgressController() {
  useEffect(() => {
    const { setProgress, setActiveSection, setBoardOpen } =
      useScrollStore.getState();
    let lastActive: string | null = null;
    let lastWritten = -1; // nilai progress terakhir yang benar-benar ditulis
    let pending: number | null = null;
    let progressRaf = 0;
    // Anti-stale tops: gambar sertifikat lazy mengubah tinggi section
    // SAAT user scroll → cachedTops basi → spy & snap salah target.
    // Segarkan maksimal 2×/detik di jalur flush (sudah rAF-throttled).
    let lastTopsRefresh = 0;

    const flushProgress = () => {
      progressRaf = 0;
      if (pending === null) return;
      const p = pending;
      pending = null;
      const now = performance.now();
      if (now - lastTopsRefresh > 500) {
        lastTopsRefresh = now;
        refreshTops();
      }
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
            //
            // THRESHOLD TENGAH VIEWPORT: section aktif ketika TOP-nya
            // melewati tengah layar (bukan tepi atas). Dengan spy tepi-
            // atas, section TINGGI (Sertifikat) sudah "masuk" dari bawah
            // selagi kartu Contact masih aktif sampai top-nya tepat di
            // atas — satu viewport penuh kartu Contact + grid Sertifikat
            // tampil BERSAMAAN (laporan: "Contact & Sertifikat menimpa").
            // Tengah-viewport memindah crossfade ½ viewport lebih awal:
            // kartu berganti saat section berikutnya menguasai ≥½ layar.
            // Di STOP snap (scrollY tepat di top section) section aktif
            // IDENTIK dengan spy lama — perilaku desktop/stop tidak
            // berubah; section terakhir (Sertifikat) aktif sampai akhir.
            //
            // Pengecualian section TERAKHIR (Sertifikat, >100vh, grid
            // mulai ±150px dari top section): ambang 0.9vh — kartu
            // Contact lepas SEBELUM satu piksel grid pun menyentuh
            // viewport (grid masuk saat scrollY = top+150−vh; switch di
            // top−0.9vh = 66px lebih awal) → Contact & grid Sertifikat
            // tidak pernah tampil bersamaan saat scroll transisi.
            const tops = cachedTops;
            let section: string;
            if (tops) {
              const scrollY = self.progress * maxScroll();
              section = "hero";
              for (let i = 0; i < tops.length; i++) {
                const frac = i === tops.length - 1 ? 0.9 : 0.5;
                if (scrollY + window.innerHeight * frac >= tops[i]) {
                  section = SHOTS[i]?.id ?? "hero";
                }
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
    // Coarse pointer (layar sentuh utama) — dibaca SEKALI + listener
    // live: seluruh penyetelan gesture di bawah hanya aktif saat
    // coarse; jalur fine pointer identik dengan sebelumnya. Pinch-zoom
    // halaman juga dimatikan (gesturestart) selama coarse.
    // ------------------------------------------------------------------
    const mqCoarse = window.matchMedia(MQ.coarse);
    let coarse = mqCoarse.matches;
    const onGestureStart = (e: Event) => e.preventDefault();
    const setPinchGuard = (active: boolean) => {
      if (active) {
        document.addEventListener("gesturestart", onGestureStart, {
          passive: false,
        });
      } else {
        document.removeEventListener("gesturestart", onGestureStart);
      }
    };
    setPinchGuard(coarse);
    const onCoarseChange = (e: MediaQueryListEvent) => {
      coarse = e.matches;
      setPinchGuard(coarse);
    };
    mqCoarse.addEventListener("change", onCoarseChange);

    // ------------------------------------------------------------------
    // Gesture snapper — fullpage-style: satu gestur → snap ke section
    // bersebelahan. Window adalah scroller; #main-scroll adalah kontainer
    // tinggi (section h-screen bertumpuk). Scrub: 1 pada ScrollTrigger
    // menyerap lompatan sebagai damping kamera.
    // ------------------------------------------------------------------
    let locked = false; // true selama animasi snap berjalan
    let cooldownUntil = 0; // timestamp ms — setelah animasi, tunggu sejenak
    let snapTween: gsap.core.Tween | null = null;
    // Wheel gesture gate (round 6B) — SATU gestur wheel = TEPAT satu
    // advan section. MODEL: STEPPING THROTTLE (fullpage klasik).
    // - Selama input wheel MENGALIR (event berjarak < STREAM_GAP_RESET_MS),
    //   tiap siklus lock (~850ms) memajukan TEPAT satu section — scroll
    //   kontinu terasa "berpindah terus", tanpa perlu lepas jari.
    // - Jeda > STREAM_GAP_RESET_MS = stream baru: accum dibuang, jadi
    //   gesekan kecil terpisah tidak pernah menjumlah diri.
    // - Selama lock: event diabaikan (1 langkah per siklus lock), tapi
    //   TIDAK dibuang permanen — stream yang masih mengalir otomatis
    //   memicu langkah berikutnya begitu lock lepas.
    // - NOISE_FLOOR: event mikro (jari diam di trackpad) diabaikan.
    let wheelAccum = 0;
    let lastWheelT = 0;
    let touchStartY: number | null = null;
    let touchStartX: number | null = null;
    // Waktu touchstart (ms) — usia gesture untuk uji flick keluar
    // inspeksi di coarse.
    let touchStartTime = 0;
    // Guard tepi: gesture yang lahir <24px dari tepi kiri/kanan layar
    // milik gesture sistem browser (back/forward, selalu horizontal)
    // — hanya swallow gesture horizontal; vertical dari tepi sah.
    let touchEdge = false;
    // Gesture mulai di kontrol UI eksplisit ([data-ui-interactive] —
    // backdrop/panel quest): tanpa snap, tanpa flick, tanpa board op;
    // touchmove tetap di-preventDefault (bunuh native scroll halaman
    // di belakang sheet) supaya synthesized click selalu sampai.
    let touchUiStart = false;
    // Gesture mulai di region native-scroll: elemen penandanya cached
    // untuk chain-block (lihat onTouchMove) + apakah elemen itu
    // scroller sungguhan (overflow auto/scroll) atau passthrough
    // (grid sertifikat — native scroll HALAMAN memang disengaja).
    let nativeScrollEl: Element | null = null;
    let nativeScrollIsScroller = false;
    // Chain-block pernah mencegah scroll halaman di gesture ini
    // (scroller nested mentok) → touchend boleh menjalankan snap.
    let chainBlocked = false;
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
      // Kunci kedua input (wheel & touch) selama animasi + cooldown
      // sehingga tidak ada gestur geser yang melompati section.
      locked = true;
      cooldownUntil =
        performance.now() + SNAP_DURATION * 1000 + COOLDOWN_MS;
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
      const tops = getSectionTops();
      if (!tops) return;
      // BASIS SECTION LOGIS (fix root-cause skip): current diambil dari
      // activeSection (spy scroll-spy = section yang PASTI sedang di-
      // layar saat gate membuka event), BUKAN window.scrollY mentah.
      // scrollY mentah mid-tween/rail-glide menghasilkan current salah
      // → skip section (laporan: "skip section yang lain"). Spy selalu
      // benar di titik gate membuka event karena isLocked() menahan
      // event selama tween.
      const { activeSection } = useScrollStore.getState();
      let current = SHOTS.findIndex((s) => s.id === activeSection);
      if (current < 0) {
        // Fallback defensif: derive dari posisi aktual.
        const y = window.scrollY;
        current = 0;
        tops.forEach((t, i) => {
          if (y >= t - 30) current = i;
        });
      }
      const target = Math.max(
        0,
        Math.min(SECTION_COUNT - 1, current + Math.sign(direction))
      );
      scrollToSection(target);
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
      // Wheel di atas area scroll internal (grid sertifikat) →
      // serahkan ke native scrolling, gesture system tidak ikut campur.
      if (
        e.target instanceof Element &&
        e.target.closest("[data-native-scroll]")
      ) {
        return;
      }
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
      // ------------------------------------------------------------------
      // VERTIKAL — STEPPING THROTTLE (model fullpage klasik):
      // - Input MENGALIR (gap antar event < STREAM_GAP_RESET_MS): tiap
      //   siklus lock (~850ms) maju TEPAT satu section — trackpad/mouse
      //   scroll kontinu terasa berpindah terus tanpa lepas jari.
      // - Jeda > STREAM_GAP_RESET_MS = stream baru → accum dibuang
      //   (gesekan kecil terpisah tidak pernah menjumlah diri).
      // - NOISE_FLOOR: event mikro (jari diam di trackpad) diabaikan.
      // - Selama lock: event diabaikan — stream yang masih mengalir
      //   otomatis melangkahkan begitu lock lepas (throttle, bukan gate).
      // - preventDefault di SEMUA jalur vertikal: gesture system pemilik
      //   scroll halaman (tanpa drift antara section).
      // ------------------------------------------------------------------
      const nowT = performance.now();
      const gap = nowT - lastWheelT;
      lastWheelT = nowT;
      // Stream baru setelah jeda panjang → buang sisa akumulasi lama.
      if (gap > STREAM_GAP_RESET_MS) wheelAccum = 0;
      if (isLocked()) {
        // Satu langkah sudah dipakai untuk siklus lock ini.
        e.preventDefault();
        return;
      }
      e.preventDefault();
      // Firefox line-mode: 1 notch = 3 lines ≈ 100px — samakan skala.
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      if (Math.abs(dy) < NOISE_FLOOR) return;
      wheelAccum += Math.abs(dy);
      if (wheelAccum < STEP_ACC_THRESHOLD) return;
      wheelAccum = 0; // langkah dipakai — langkah berikutnya lewat lock
      snapAdjacent(dy);
    };

    // Touch — catat Y saat touchstart, nilai saat touchend menentukan swipe.
    // Mulai di atas area scroll internal (grid sertifikat) → gesture
    // system TIDAK ikut campur: native scrolling milik area tersebut.
    let nativeScrollStart = false;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartY = t ? t.clientY : null;
      touchStartX = t ? t.clientX : null;
      touchAxis = null; // arah dominan gestur belum diketahui
      touchStartTime = t ? performance.now() : 0;
      touchEdge = !!t && (t.clientX < EDGE_ZONE_PX || t.clientX > window.innerWidth - EDGE_ZONE_PX);
      chainBlocked = false;
      const target =
        e.target instanceof Element ? e.target : null;
      const nativeMark = target?.closest("[data-native-scroll]") ?? null;
      nativeScrollEl = nativeMark;
      nativeScrollIsScroller = !!nativeMark &&
        (getComputedStyle(nativeMark).overflowY === "auto" ||
          getComputedStyle(nativeMark).overflowY === "scroll");
      nativeScrollStart = !!nativeMark;
      // Kontrol UI eksplisit (backdrop/panel quest) — gesture system
      // mundur total; click sintetis harus selalu sampai.
      touchUiStart = !!target?.closest("[data-ui-interactive]");
    };
    const onTouchMove = (e: TouchEvent) => {
      if (nativeScrollStart) {
        // COARSE — cegah scroll CHAINING dari scroller nested mentok
        // ke halaman: kartu mobile yang kontennya pas/mentok membuat
        // browser meneruskan scroll ke PAGE secara native (momentum)
        // → halaman nyasar dari snap → swipe terasa mati lalu skip.
        // Scroller sungguhan di ujungnya → preventDefault + tandai;
        // scroller yang muat (tidak scrollable) → block total.
        // Passthrough (grid sertifikat, overflow visible) → biarkan:
        // membaca sertifikat = native scroll halaman (by design).
        if (coarse && nativeScrollEl && nativeScrollIsScroller) {
          const el = nativeScrollEl;
          const scrollable = el.scrollHeight - el.clientHeight > 1;
          const t = e.touches[0];
          const dyNow =
            t && touchStartY !== null ? touchStartY - t.clientY : 0;
          const atTop = el.scrollTop <= 0;
          const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          const mustBlock =
            !scrollable ||
            (dyNow > 2 && atEnd) ||
            (dyNow < -2 && atTop);
          if (mustBlock) {
            // HANYA bila preventDefault MASIH BISA bekerja (cancelable):
            // cancelable=false = Chrome sudah commit ke scroll native
            // (grid sedang menggulir sendiri, biasanya mentok tepi di
            // TENGAH gesture). Menandai chainBlocked di state itu
            // menyulap snap section dari gesture milik grid — inilah
            // akar "macet lalu tiba-tiba lompat" (round-6D probe).
            if (e.cancelable) {
              e.preventDefault();
              if (Math.abs(dyNow) > 2) chainBlocked = true;
            }
          }
        }
        return; // selain itu: serahkan ke native scrolling
      }
      // Kontrol UI eksplisit (backdrop quest, dsb.) — gesture TAP
      // (jitter <10px) DILEPAS sepenuhnya: preventDefault touchmove di
      // iOS/Android MENYINGKIRKAN click sintetis gesture itu — inilah
      // akar "Tutup/backdrop tidak bisa diklik". Swipe besar (>10px)
      // di-preventDefault supaya halaman di belakang sheet tidak
      // ikut menggulir; touchend-nya di-skip (uiStart).
      if (touchUiStart) {
        const t = e.touches[0];
        if (
          t &&
          touchStartY !== null &&
          Math.abs(t.clientY - touchStartY) > 10
        ) {
          e.preventDefault();
        }
        return;
      }
      // Tentukan arah dominan sekali di gerak pertama yang bermakna:
      // horizontal → fine pointer: biarkan lewat (tanpa preventDefault)
      // supaya gestur sampai ke touchend; coarse: native scroll
      // dihalangi saat papan terbuka / di hero (lihat bawah).
      // Vertikal → halangi scroll native (snap dikejar di touchend).
      // Tidak ada scroll horizontal di halaman, jadi melepas kunci
      // horizontal aman.
      if (touchAxis === null) {
        const t = e.touches[0];
        if (t && touchStartX !== null && touchStartY !== null) {
          const dx = Math.abs(t.clientX - touchStartX);
          const dy = Math.abs(t.clientY - touchStartY);
          // Kunci arah: 8px fine pointer, 12px coarse (sentuhan lebih
          // kasar — cegah axis "kembar" di gerak awal).
          const axisLock = coarse ? 12 : 8;
          if (dx > axisLock || dy > axisLock) {
            touchAxis = dx > dy ? "x" : "y";
          }
        }
      }
      if (touchAxis === "x") {
        // Coarse: horizontal saat papan terbuka / di hero → kunci
        // native scroll supaya gesture papan bersih (tanpa bounce).
        if (coarse) {
          const st = useScrollStore.getState();
          if (st.boardOpen || st.activeSection === "hero") e.preventDefault();
        }
        return;
      }
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY === null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = touchStartY - t.clientY; // geser ke atas → dy positif
      const dx = touchStartX === null ? 0 : t.clientX - touchStartX;
      const elapsed = performance.now() - touchStartTime;
      // Salin + reset SEMUA state gesture SEBELUM return mana pun —
      // tanpa ini, return awal meninggalkan flag menyala dan gesture
      // BERIKUTNYA salah klasifikasi (sumber "swipe pertama mati").
      touchStartY = null;
      touchStartX = null;
      touchAxis = null;
      const edgeStart = touchEdge;
      touchEdge = false;
      const uiStart = touchUiStart;
      touchUiStart = false;
      const nativeStart = nativeScrollStart;
      nativeScrollStart = false;
      const wasChainBlocked = chainBlocked;
      chainBlocked = false;

      const { boardOpen, activeSection, boardInspect, setBoardInspect, setBoardOpen } =
        useScrollStore.getState();
      // Intent horizontal BOARD — dominansi LONGGAR (dx > dy, ambang
      // 40px khusus): arc jempol saat "geser kanan" melengkung turun,
      // rasio ketat 1.15 memakan swipe sah (laporan HP: "gabisa geser
      // ke kanan"). Tujuan tetap terfilter ketat di dalam blok: hanya
      // hero-open / board-close yang berlaku; sisanya jatuh ke snap.
      const horizontal =
        Math.abs(dx) >= BOARD_SWIPE_MIN &&
        Math.abs(dx) > Math.abs(dy);
      const horizontalTight =
        Math.abs(dx) >= TOUCH_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * 1.3;

      // Kontrol UI eksplisit (backdrop "Tutup" quest, panel) — TANPA
      // logika gesture sama sekali: tap harus menghasilkan click
      // sintetis (closure 2px tersedia — handler touch tidak pernah
      // preventDefault di jalur ini).
      if (uiStart) return;

      // Edge-swipe guard: gesture tepi milik sistem browser (back/
      // forward — HORIZONTAL). Vertikal dari tepi tetap gesture
      // halaman yang sah (user menyentuh dekat tepi saat memegang HP).
      if (edgeStart && horizontal) return;

      // Gesture native-scroll (kartu mobile / panel quest / grid
      // sertifikat): seluruhnya milik elemen — KECUALI chain-block
      // scroller mentok (onTouchMove) — gesture itu tetap milik
      // scroller, tapi touchend-nya BOLEH snap (panjang ≥40px =
      // intent pindah section yang jelas).
      if (nativeStart && !wasChainBlocked) return;

      // COARSE — flick kiri CEPAT keluar inspeksi. VELOCITY-based
      // (dx/elapsed), bukan window usia: sebelumnya `now-start<350ms`
      // MENYINGKIRKAN flick jari cepat yang diakhiri sebelum batas
      // waktu termasuk — harusnya `elapsed` BOLEH lebih besar asal
      // kecepatannya tinggi (450ms @ ≥142px/s; jempol mudah ≥400px/s).
      // BoardOpen TIDAK disyaratkan: inspeksi selalu berada di dalam
      // board, dan pada perangkat sentuh flag ini terpasang JAUH lebih
      // awal (drag-promote pointermove) — syarat lama membuat flick
      // pertama sesudah inspect sering meleset.
      //
      // PENTING: boardDrag.moved TIDAK boleh jadi syarat — flick
      // 64px+ di canvas SELALU menaikkan moved (>24px via pointermove
      // CameraRig), jadi syarat itu membuat flick exit mustahil di
      // jalur 3D. Trailing click setelah flick tetap tertelan: moved
      // sudah true dan resolver proxy meng-consume + me-reset flag.
      if (
        coarse &&
        boardInspect &&
        dx >= FLICK_EXIT_DX &&
        elapsed < 450
      ) {
        setBoardInspect(false);
        return;
      }

      // ---------------------------------------------------------------
      // HERO — BUKA PAPAN: aturan PALING longgar, dicek sebelum gerbang
      // horizontal apa pun. Arc jempol saat "geser kanan" hampir selalu
      // melengkung turun sehingga |dy| sering ≥ |dx| — gerbang horizontal
      // ketat membuat gesture ini gugur (laporan berulang dari HP).
      // Aturan baru: selama BUKAN vertikal murni (|dy| < 1.5×|dx|) dan
      // komponen kanan cukup (≥36px), itu intent buka papan.
      // ---------------------------------------------------------------
      // ---------------------------------------------------------------
      // INTENT HORIZONTAL (sentuh) — SEMANTIK TERBALIK sesuai laporan
      // user: KIRI = buka papan (carousel: konten kanan "ditarik" masuk),
      // KANAN = kembali/tutup. Dominansi longgar (|dy| < 1.5×|dx|) —
      // arc jempol melengkung turun. Diproses SEBELUM suppress
      // boardDrag.moved; desktop (wheel/keyboard) jalur terpisah.
      // ---------------------------------------------------------------
      if (
        !boardOpen &&
        activeSection === "hero" &&
        dx < 0 &&
        dx <= -36 &&
        Math.abs(dy) < Math.abs(dx) * 1.5 &&
        !edgeStart &&
        !uiStart &&
        !isLocked()
      ) {
        setBoardOpen(true);
        return;
      }

      if (
        boardOpen &&
        dx > 0 &&
        Math.abs(dx) >= BOARD_SWIPE_MIN &&
        Math.abs(dy) < Math.abs(dx) * 1.5 &&
        !edgeStart &&
        !uiStart &&
        !isLocked()
      ) {
        // KANAN = kembali/tutup (mirror dari buka-kiri).
        if (boardInspect) setBoardInspect(false);
        else setBoardOpen(false);
        return;
      }

      // Drag-pan inspeksi baru selesai → event ini adalah akhir pan,
      // bukan gesture keluar. BACA SAJA — jangan reset di sini: flag
      // juga dibaca resolver klik SETELAH touchend (click event
      // menyusul touchend); reset dilakukan pointerdown berikutnya.
      if (boardDrag.moved) {
        return;
      }

      // Vertikal saat inspeksi di coarse = PAN kamera (miliki
      // CameraRig) — bukan exit. Fine pointer: vertikal tetap keluar.
      if (boardOpen) {
        if (!coarse && boardInspect && !horizontal) setBoardInspect(false);
        return;
      }

      // Papan tertutup + bukan hero: horizontal = dead-end, tapi hanya
      // yang BENAR-BENAR mendominan (rasio ketat); yang nyaris-sejajar
      // dibiarkan jatuh ke snap vertikal (anti swipe wobbly jadi mati).
      if (horizontalTight) return;

      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      if (isLocked()) return; // Kunci aktif: cegah loncat section saat animasi berlangsung

      if (boardInspect) {
        setBoardInspect(false);
        return;
      }

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

    const onRailJump = () => {
      snapTween?.kill();
      locked = false;
      cooldownUntil = 0; // lock lebar — langkah wheel berikutnya langsung siap
      wheelAccum = 0;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("rail:jump", onRailJump);

    // Refresh setelah font/layout stabil agar ukuran trigger akurat —
    // sekalian segarkan posisi section (tops) untuk mapping aktif.
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      refreshTops();
    });

    return () => {
      mqCoarse.removeEventListener("change", onCoarseChange);
      setPinchGuard(false); // lepas gesturestart guard
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("rail:jump", onRailJump);
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
