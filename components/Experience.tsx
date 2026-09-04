"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useRef } from "react";
import Avatar from "./Avatar";
import CameraRig from "./CameraRig";
import Chalkboard from "./Chalkboard";
import LightingRig from "./LightingRig";
import ContactGlow from "./ContactGlow";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * DynamicQuality — pengendali kualitas adaptif (perf round 2).
 *
 * PerformanceMonitor (drei) hanya memicu event setelah pembacaan fps
 * SUSTAINED — bukan sekali spike: rata-rata fps di-sampling tiap 250ms,
 * event baru dijalankan bila >=75% sampel (min. 8 dari 10 iterasi,
 * ~2.5 detik) berada di luar bounds. Artinya: turun kualitas hanya
 * saat GPU benar-benar kewalahan, dan naik lagi (snap back ke dpr awal)
 * saat headroom kembali. Tidak ada pengorbanan kualitas permanen selama
 * GPU sanggup.
 *
 * Bounds (fps): layar <=100Hz → [45, 58]; >100Hz → [55, 70].
 * flipflops 4: belokan arah ke-5 (naik-turun yang tak menentu) memicu
 * fallback → dpr menetap di lantai regressed sampai reload. Ini mencegah
 * osilasi kualitas yang kelihatan (kompromi yang disengaja untuk GPU
 * marginal), bukan pengurangan kualitas bagi mayoritas perangkat.
 *
 * Tangga dpr = multiplier terhadap dpr awal (hasil clamp [1, 1.75]):
 *   rung 2 (default): 1.00 → hidpi 1.75, layar 1x tetap 1.0
 *   rung 1          : 0.85 → hidpi ~1.49
 *   rung 0          : 0.72 → hidpi ~1.26 (di dalam jendela 1.0–1.25)
 *
 * Perubahan dpr dianimasikan halus (~350ms, easing smoothstep) via rAF,
 * BUKAN melompat sekaligus — transisi resolusi tidak terlihat.
 * Jika tab di-hidden, rAF berhenti otomatis (browser behavior), jadi
 * tidak ada rAF yang bocor.
 */
const QUALITY_LADDER = [0.72, 0.85, 1] as const;
const DPR_CHANGE_MS = 350;

function DynamicQuality() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const active = useThree((s) => s.internal.active);
  const initialDpr = useThree((s) => s.viewport.initialDpr);

  const rung = useRef(QUALITY_LADDER.length - 1);
  const from = useRef(initialDpr);
  const startedAt = useRef(0);
  const raf = useRef(0);

  // Nilai terkini untuk cleanup-once (tanpa re-run effect tiap perubahan)
  const latest = useRef({ active, initialDpr, setDpr });
  latest.current = { active, initialDpr, setDpr };

  const animateTo = (target: number) => {
    from.current = gl.getPixelRatio();
    startedAt.current = performance.now();
    if (raf.current === 0) {
      const tick = () => {
        raf.current = 0;
        const { setDpr: set } = latest.current;
        const a = Math.min(
          1,
          (performance.now() - startedAt.current) / DPR_CHANGE_MS
        );
        const e = a * a * (3 - 2 * a); // smoothstep
        set(from.current + (target - from.current) * e);
        if (a < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }
  };

  // Kembalikan dpr awal saat unmount — kontrak yang sama dengan AdaptiveDpr
  useEffect(
    () => () => {
      if (raf.current !== 0) cancelAnimationFrame(raf.current);
      raf.current = 0;
      const { active: isActive, initialDpr: init, setDpr: set } = latest.current;
      if (isActive) set(init);
    },
    []
  );

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
      bounds={(refreshrate) =>
        refreshrate > 100 ? [55, 70] : [45, 58]
      }
      flipflops={4}
      onIncline={onIncline}
      onDecline={onDecline}
      onFallback={onFallback}
    />
  );
}

/**
 * FlashRegress — jembatan murah flash→scene: saat `camera-flash:begin`
 * (dispatch dari CameraFlash), panggil `performance.regress()` → dpr
 * turun sementara via AdaptiveDpr (auto-recover setelah debounce 200ms).
 * Layar nyaris putih di puncak kilatan, jadi penurunan resolusi tidak
 * terlihat — biaya render 3D turun tepat di jendela paling ramai.
 */
function FlashRegress() {
  const regress = useThree((s) => s.performance.regress);
  useEffect(() => {
    const onFlashBegin = () => regress();
    window.addEventListener("camera-flash:begin", onFlashBegin);
    return () =>
      window.removeEventListener("camera-flash:begin", onFlashBegin);
  }, [regress]);
  return null;
}

/**
 * StudioFloor — lantai studio GELAP STATIS. Keputusan final: tanpa
 * real-time reflection sama sekali. MeshReflectorMaterial (scene
 * dirender KEDUA + blur tiap frame + FBO resize saat dpr berubah)
 * adalah akar lag di semua interaksi, glitch kilatan hitam, dan
 * frame-drop — biayanya jauh melampaui nilai kilau mirror di lantai
 * near-black. Mood studio tetap utuh via: kolam emas, ContactGlow,
 * beam + kerucut, dan bayangan avatar/papan yang jatuh ke lantai ini.
 */
function StudioFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#050507" roughness={0.9} metalness={0.15} />
    </mesh>
  );
}

/**
 * Experience — scene utama R3F (final, fase 6).
 *
 * Performa mobile / low-end:
 * - dpr di-clamp ke [1, 1.75]: layar devicePixelRatio tinggi (4K/retina)
 *   tidak me-render di atas 1.75, layar 1x render di resolusi native
 *   (tidak lagi supersample 1.75x). DynamicQuality (PerformanceMonitor
 *   + AdaptiveDpr) menurunkan dpr bertahap saat GPU kewalahan dan
 *   mengembalikannya saat headroom kembali.
 * - powerPreference "high-performance": minta GPU diskrit bila tersedia.
 * - frameloop default "always" — CameraRig damping tiap frame, jangan
 *   diganti "demand".
 * - Shadow ringan di layar kecil (ukuran map 512 + area lebih ketat)
 *   — perceptual difference minimal, hemat fill-rate GPU mobile.
 * - alpha true: background gradient CSS di belakang canvas.
 * - FlashRegress: jendela kilatan kamera me-regress performa sementara
 *   (layar dominan putih saat itu, jadi tak terlihat).
 */
export default function Experience() {
  // Papan terbuka (hero) → canvas harus menerima pointer agar klik
  // papan/kertas ke-raycast. Di luar kondisi itu pointer-events-none
  // (default) supaya teks section & kartu tetap klikabel.
  const boardOpen = useScrollStore((s) => s.boardOpen);

  return (
    <div
      className={`fixed inset-0 z-0 ${
        boardOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <Canvas
        camera={{ position: [0, 1.6, 6.2], fov: 35 }}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        shadows="percentage"
        /* Background void di-set via <color attach="background"> */
        style={{ background: "#000000" }}
      >
        {/* Turunkan resolusi render otomatis saat frame rate drop.
            PerformanceMonitor hanya men-trigger pada drop SUSTAINED
            (bukan spike sekali), jadi keputusan turun kualitas selalu
            berbasis fps rata-rata, bukan noise. */}
        <DynamicQuality />
        <AdaptiveDpr pixelated={false} />
        {/* Jendela kilatan kamera → performance.regress() sementara.
            Tidak terlihat: layar dominan putih saat flash puncak. */}
        <FlashRegress />

        {/* Background void: hitam pekat solid, tanpa gradasi */}
        <color attach="background" args={["#000000"]} />

        {/* Fog hitam pekat — area jauh melebur ke void, tanpa
            gradasi kebiruan */}
        <fogExp2 attach="fog" args={["#000000", 0.075]} />

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

        {/* Lantai studio gelap statis — tanpa real-time reflection */}
        <StudioFloor />

        {/* Kamera sinematik berbasis scroll (reduced-motion aware) */}
        <CameraRig />
      </Canvas>
    </div>
  );
}
