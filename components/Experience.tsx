"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import CameraRig from "./CameraRig";
import Chalkboard from "./Chalkboard";
import LightingRig from "./LightingRig";
import ContactGlow from "./ContactGlow";
import { useScrollStore } from "@/store/useScrollStore";
import { useViewportTier, tierRefs, MQ } from "@/hooks/useViewportTier";
import { isLowEndDevice } from "@/lib/detectDevice";

/**
 * DynamicQuality — pengendali kualitas adaptif.
 *
 * PerformanceMonitor (drei) hanya memicu event setelah pembacaan fps
 * SUSTAINED — bukan sekali spike: rata-rata fps di-sampling tiap 250ms,
 * event baru dijalankan bila >=75% sampel (min. 8 dari 10 iterasi,
 * ~2.5 detik) berada di luar bounds. Artinya: turun kualitas hanya
 * saat GPU benar-benar kewalahan, dan naik lagi saat headroom kembali.
 *
 * Bounds (fps): refreshrate >100Hz → [48, 60]; <=100Hz → [38, 50]
 * — HANYA di tier compact. Desktop memakai bounds asli [45, 58] /
 * [55, 70] (kontrak "desktop byte-identical").
 * flipflops 4: belokan arah ke-5 (naik-turun yang tak menentu) memicu
 * fallback → dpr menetap di lantai regressed sampai reload.
 *
 * Tangga dpr = multiplier terhadap dpr awal (hasil clamp [1, 1.75]):
 *   rung 2 (desktop default): 1.00 → hidpi 1.75
 *   rung 1 (compact default): 0.85 → hidpi ~1.49
 *   rung 0          : 0.72 → hidpi ~1.26
 *
 * PENTING (fix glitch hitam): perubahan dpr = SET SEKALI via setDpr.
 * Dulu dianimasikan via rAF (~20× setDpr per transisi) — tiap setDpr
 * memicu canvas resize → kilatan hitam berulang persis di momen berat.
 * Lompatan resolusi antar rung praktis tak terlihat; kilatannya yang
 * terlihat.
 */
const QUALITY_LADDER = [0.72, 0.85, 1] as const;

/** SceneFog — densitas per-tier: shot compact 2× lebih jauh dari
 *  desktop → fog lama 0.075 menelan ±13-28% terang di jarak itu
 *  (laporan: "HP jauh lebih gelap dari desktop"). 0.05 di compact
 *  menyeimbangkan; desktop tetap 0.075 persis. Reaktif via hook —
 *  rotasi device ikut menyesuaikan. */
function SceneFog() {
  const { tier } = useViewportTier();
  return <fogExp2 attach="fog" args={["#000000", tier === "compact" ? 0.05 : 0.075]} />;
}

function DynamicQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const initialDpr = useThree((s) => s.viewport.initialDpr);
  const { coarse } = useViewportTier();
  const isLowEnd = isLowEndDevice();

  // Low-end mulai dari rung 0 (paling hemat) agar tidak lag di awal; coarse umum mulai rung 1; desktop rung 2
  const rung = useRef(isLowEnd ? 0 : coarse ? 1 : QUALITY_LADDER.length - 1);
  const latest = useRef({ initialDpr, setDpr });
  latest.current = { initialDpr, setDpr };

  const animateTo = (target: number) => {
    latest.current.setDpr(target);
  };

  // Kembalikan dpr awal saat unmount — kontrak yang sama dengan AdaptiveDpr
  useEffect(
    () => () => {
      const { initialDpr: init, setDpr: set } = latest.current;
      set(init);
    },
    []
  );

  // Terapkan rung awal SEKALI di mount — hanya saat rung < penuh
  // (coarse). Desktop: rung 2 = dpr awal, TANPA setDpr (canvas resize
  // tidak pernah terjadi — kontrak "set sekali" tetap utuh).
  useEffect(() => {
    if (rung.current !== QUALITY_LADDER.length - 1) {
      latest.current.setDpr(
        QUALITY_LADDER[rung.current] * latest.current.initialDpr
      );
    }
  }, []);

  const onIncline = () => {
    const next = Math.min(rung.current + 1, QUALITY_LADDER.length - 1);
    if (next === rung.current) return;
    rung.current = next;
    animateTo(QUALITY_LADDER[next] * latest.current.initialDpr);
  };

  const onDecline = () => {
    const next = Math.max(rung.current - 1, 0);
    if (next === rung.current) return;
    rung.current = next;
    animateTo(QUALITY_LADDER[next] * latest.current.initialDpr);
  };

  const onFallback = () => {
    if (rung.current === 0) return;
    rung.current = 0;
    animateTo(QUALITY_LADDER[0] * latest.current.initialDpr);
  };

  return (
    <PerformanceMonitor
      /* Bounds per tier (read dari tierRefs — tanpa re-render):
         compact = ambang agresif; desktop = nilai asli. */
      bounds={(refreshrate) => {
        if (tierRefs.compact.current) {
          return refreshrate > 100 ? [48, 60] : [38, 50];
        }
        return refreshrate > 100 ? [55, 70] : [45, 58];
      }}
      flipflops={4}
      onIncline={onIncline}
      onDecline={onDecline}
      onFallback={onFallback}
    />
  );
}

/**
 * Catatan perf: dulu ada FlashRegress (dpr turun via regress() di
 * jendela flash/gate). DIHAPUS — setDpr memicu canvas resize: frame
 * hitam (glitch) + jank main-thread tepat saat transisi, yang meng-
 * habiskan jendela animasi. Biaya render utama sudah dipangkas di
 * akarnya (tanpa reflektor real-time, model terkompresi, damping
 * ringan), jadi jendela flash tidak butuh trik resolusi lagi.
 */

/**
 * Experience — scene utama R3F (final, fase 6).
 *
 * Performa mobile / low-end:
 * - dpr di-clamp ke [1, 1.25]: GPU lemah (iGPU) jenuh di dpr tinggi —
 *   1.25 pada layar bergerak praktis identik dengan 1.75, hemat ±30%
 *   fill-rate. DynamicQuality menurunkan dpr bertahap saat GPU
 *   kewalahan dan mengembalikannya saat headroom kembali.
 * - powerPreference "high-performance": minta GPU diskrit bila tersedia.
 * - frameloop default "always" — CameraRig damping tiap frame, jangan
 *   diganti "demand".
 * - alpha true: background gradient CSS di belakang canvas.
 */
/**
 * StudioFloor — lantai studio GELAP STATIS dengan receiveShadow untuk
 * bayangan karakter (permintaan user: shadow jangan dihapus — bake
 * sekali via autoUpdate=false, jadi biaya per-frame-nya cuma sampling).
 */
function StudioFloor() {
  const { coarse } = useViewportTier();
  const isLowEnd = isLowEndDevice();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.001, 0]}
      receiveShadow
      raycast={() => null}
    >
      <planeGeometry args={[60, 60]} />
      {isLowEnd || coarse ? (
        <meshLambertMaterial color="#050507" />
      ) : (
        <meshStandardMaterial color="#050507" roughness={0.9} metalness={0.15} />
      )}
    </mesh>
  );
}

/**
 * StaticShadows — scene STATIS: pass bayangan (render ulang semua
 * caster + sampling 1024²) TIDAK berjalan tiap frame — autoUpdate
 * false, di-bake saat papan/kertas masuk scene (di dalam jendela
 * loading). Bayangan karakter dipertahankan (permintaan user).
 */
function StaticShadows() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    const bake = () => {
      gl.shadowMap.needsUpdate = true;
    };
    bake(); // mount — scene kosong/parsial, murah
    const onFitted = () => bake(); // papan glb masuk scene
    const onPapers = () => setTimeout(bake, 400); // kertas masuk scene
    window.addEventListener("chalkboard:fitted", onFitted);
    window.addEventListener("chalkboard:papers", onPapers);
    return () => {
      window.removeEventListener("chalkboard:fitted", onFitted);
      window.removeEventListener("chalkboard:papers", onPapers);
    };
  }, [gl]);
  return null;
}

/**
 * SceneWarmup — jembatan assetsLoaded → sceneReady DI DALAM Canvas.
 * Setelah semua aset termuat: frame 1 memaksa kompilasi SEMUA shader
 * (gl.compile) + bake bayangan sekali; butuh ≥8 frame ter-render dan
 * ≥400ms agar GPU benar-benar stabil — baru sceneReady (gerbang
 * "Klik untuk mulai" muncul). Inilah sumber kebenaran gerbang: klik
 * tidak mungkin lagi mendarat di jendela warm-up, karena warm-up
 * SELESAI sebelum tombolnya ada. Safety timeout 8s (anti stuck).
 */
function SceneWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const assetsLoaded = useScrollStore((s) => s.assetsLoaded);
  const frames = useRef(0);
  const startedAt = useRef(0);

  useFrame(() => {
    if (!assetsLoaded) return;
    const { sceneReady } = useScrollStore.getState();
    if (sceneReady) return;

    frames.current += 1;
    if (frames.current === 1) {
      startedAt.current = performance.now();
      // Kompilasi seluruh shader + bake bayangan SEKALI — pekerjaan
      // berat yang dulu terjadi SAAT KLIK (di balik gerbang sekarang).
      gl.compile(scene, camera);
      gl.shadowMap.needsUpdate = true;
    }
    if (
      frames.current >= 8 &&
      performance.now() - startedAt.current >= 400
    ) {
      useScrollStore.getState().setSceneReady(true);
    }
  });
  return null;
}

export default function Experience() {
  // Papan terbuka (hero) → canvas harus menerima pointer agar klik
  // papan/kertas ke-raycast. Di luar kondisi itu pointer-events-none
  // supaya teks section & kartu tetap klikabel.
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const isCoarseDevice =
    typeof window !== "undefined" && window.matchMedia(MQ.coarse).matches;
  const isLowEnd = typeof window !== "undefined" && isLowEndDevice();

  // DPR adaptif per kapabilitas perangkat:
  // - Perangkat Spek Rendah (HP budget & Laptop iGPU lemah): [0.85, 1.0] (tajam 1080p native, hemat >60% fill-rate)
  // - HP Flagship: [1, 1.35] (sangat tajam & jernih)
  // - Desktop PC Ber-GPU: [1, 1.25] (standar desktop)
  const dprRange: [number, number] = isLowEnd
    ? [0.85, 1.0]
    : isCoarseDevice
    ? [1, 1.35]
    : [1, 1.25];

  // Smart idle throttling: rendering hanya berjalan saat ada gerakan / interaksi
  const [frameloop, setFrameloop] = useState<"always" | "demand">("always");
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const wakeUp = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      setFrameloop("always");
    };

    const onCameraSettled = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // Tunggu 800ms setelah kamera benar-benar menetap & tanpa interaksi
      idleTimerRef.current = setTimeout(() => {
        setFrameloop("demand");
      }, 800);
    };

    const onCameraMoving = () => {
      wakeUp();
    };

    window.addEventListener("camera:settled", onCameraSettled);
    window.addEventListener("camera:moving", onCameraMoving);
    window.addEventListener("scroll", wakeUp, { passive: true });
    window.addEventListener("wheel", wakeUp, { passive: true });
    window.addEventListener("touchstart", wakeUp, { passive: true });
    window.addEventListener("touchmove", wakeUp, { passive: true });
    window.addEventListener("pointerdown", wakeUp, { passive: true });
    window.addEventListener("keydown", wakeUp, { passive: true });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("camera:settled", onCameraSettled);
      window.removeEventListener("camera:moving", onCameraMoving);
      window.removeEventListener("scroll", wakeUp);
      window.removeEventListener("wheel", wakeUp);
      window.removeEventListener("touchstart", wakeUp);
      window.removeEventListener("touchmove", wakeUp);
      window.removeEventListener("pointerdown", wakeUp);
      window.removeEventListener("keydown", wakeUp);
    };
  }, []);

  return (
    <div
      tabIndex={-1}
      style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
      className={`fixed inset-0 z-0 select-none outline-none ${
        boardOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <Canvas
        camera={{ position: [0, 1.6, 6.2], fov: 35 }}
        dpr={dprRange}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          precision: isLowEnd ? "mediump" : "highp",
        }}
        frameloop={frameloop}
        shadows={isLowEnd ? true : "percentage"}
        tabIndex={-1}
        style={{
          background: "#000000",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <DynamicQuality />
        <StaticShadows />
        <SceneWarmup />

        {/* Background void: hitam pekat solid, tanpa gradasi */}
        <color attach="background" args={["#000000"]} />

        {/* Fog hitam pekat — area jauh melebur ke void, tanpa
            gradasi kebiruan. DENSITAS PER-TIER: shot compact 2× lebih
            jauh dari desktop → fog lama 0.075 menelan ±13-28% terang
            di jarak itu (laporan: "HP jauh lebih gelap"). 0.05 di
            compact menyeimbangkan; desktop tetap 0.075 persis. */}
        <SceneFog />

        {/* Lighting 3-titik sinematik (key/rim/fill) — hardcoded */}
        <LightingRig />

        {/* Karakter (.glb otomatis) di tengah panggung */}
        <Avatar position={[0, 0, 0]} />

        {/* Papan proyek 3D di kanan panggung (di dalam Suspense-nya
            sendiri; useProgress enter gate menunggu model ini juga) */}
        <Chalkboard />

        {/* Pool cahaya putih di titik pijak — melapisi shadow,
            avatar tampak berpijak di titik cahaya */}
        <ContactGlow />

      {/* Lantai studio gelap statis — receiveShadow untuk bayangan
          karakter (permintaan user: shadow jangan dihapus) */}
      <StudioFloor />

        {/* Kamera sinematik berbasis scroll (reduced-motion aware) */}
        <CameraRig />
      </Canvas>
    </div>
  );
}
