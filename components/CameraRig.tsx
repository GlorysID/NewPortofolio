"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SHOTS, SHOT_BY_ID } from "@/data/shots";
import type { SectionId } from "@/store/useScrollStore";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * CameraRig — kamera sinematik berbasis scroll (final, fase 6).
 *
 * Mode normal:
 * - Tiap frame baca `progress` (0–1) dari store, petakan merata ke
 *   5 shot (0 / 0.25 / 0.5 / 0.75 / 1.0), interpolasi antar dua
 *   shot terdekat dengan "hold" di tengah section + damping
 *   eksponensial — gerakan sinematik mengalir.
 *
 * Mode prefers-reduced-motion (fase 6):
 * - Animasi scrub dimatikan. Kamera hanya berpindah antar shot
 *   STATIS saat activeSection berganti, dengan transisi sangat
 *   pendek (settle cepat) — efektif cross-fade antar still.
 */

// Porsi segmen untuk "menetap" di tiap shot sebelum bergerak
const HOLD = 0.4;

// Pose kamera saat project board terbuka (hero + boardOpen): menoleh
// ke kanan menyorot chalkboard di sisi kanan panggung (Chalkboard.tsx).
const BOARD_OPEN_POS: [number, number, number] = [1.8, 1.7, 3.6];
const BOARD_OPEN_TGT: [number, number, number] = [3.2, 1.5, -0.5];

// Clamp delta damping: frame yang lambat (jank/GC) tidak boleh membuat
// kamera melompat lebih jauh dari setara frame 30fps (≈33ms). Efeknya:
// gerakan tetap kontinu saat load berat, hanya sedikit lebih terlambat
// mengejar — jauh lebih halus secara visual.
const MAX_DELTA = 1 / 30;

// Ambang "sudah menetap": error posisi+target gabungan < 1e-5 unit
// (≈0.003 unit dunia — tak terlihat pada fov 35). Di bawah ambang ini
// lookAt tidak perlu di-update lagi tiap frame.
const SETTLE_EPSILON = 1e-5;

// Buffer hasil sampling — modul-scope agar useFrame TIDAK mengalokasi
// objek/array baru tiap frame (GC churn → jank). Nilai ditimpa tiap frame.
const _sampledPos: [number, number, number] = [0, 0, 0];
const _sampledTgt: [number, number, number] = [0, 0, 0];

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Posisi & target ideal pada progress tertentu (tanpa damping).
 *  Menulis hasil ke buffer modul _sampledPos/_sampledTgt — bebas alokasi. */
function sampleShot(progress: number) {
  const segCount = SHOTS.length - 1;
  const scaled = THREE.MathUtils.clamp(progress, 0, 1) * segCount;
  const seg = Math.min(Math.floor(scaled), segCount - 1);
  const rawT = scaled - seg;

  const half = HOLD / 2;
  const t =
    rawT < half
      ? 0
      : rawT > 1 - half
        ? 1
        : smoothstep((rawT - half) / (1 - HOLD));

  const from = SHOTS[seg];
  const to = SHOTS[seg + 1];

  // Identik dengan lerp3 sebelumnya: lerp per-komponen
  _sampledPos[0] = THREE.MathUtils.lerp(from.position[0], to.position[0], t);
  _sampledPos[1] = THREE.MathUtils.lerp(from.position[1], to.position[1], t);
  _sampledPos[2] = THREE.MathUtils.lerp(from.position[2], to.position[2], t);
  _sampledTgt[0] = THREE.MathUtils.lerp(from.target[0], to.target[0], t);
  _sampledTgt[1] = THREE.MathUtils.lerp(from.target[1], to.target[1], t);
  _sampledTgt[2] = THREE.MathUtils.lerp(from.target[2], to.target[2], t);
}

export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const lookTarget = useRef(new THREE.Vector3(0, 1.3, 0));
  const desiredPos = useRef(new THREE.Vector3(...SHOTS[0].position));
  const desiredTarget = useRef(new THREE.Vector3(...SHOTS[0].target));

  // Deteksi prefers-reduced-motion (live, bisa berubah saat runtime)
  const reducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Velocity-gate: ref pointer input & status settle (bebas alokasi,
  // nilai skalar — reassign ref bukan alokasi objek)
  const lastProgress = useRef(-1);
  const lastSection = useRef<SectionId>("hero");
  const lastBoardOpen = useRef(false);
  const settled = useRef(false);

  useFrame((_, delta) => {
    const { progress, activeSection, boardOpen } = useScrollStore.getState();
    const boardChanged = boardOpen !== lastBoardOpen.current;
    lastBoardOpen.current = boardOpen;

    let lambda = 4; // responsif tapi lembut (mode normal)

    if (reducedMotion.current) {
      // Reduced motion: tanpa scrub/interpolasi — shot statis per
      // section, transisi settle sangat pendek. Setelah presisi & tanpa
      // pergantian section/board, skip seluruh update (hemat + lookAt).
      if (
        settled.current &&
        activeSection === lastSection.current &&
        !boardChanged
      )
        return;
      if (activeSection !== lastSection.current) {
        lastSection.current = activeSection;
        settled.current = false;
      }
      if (boardChanged) settled.current = false;
      const shot = SHOT_BY_ID[activeSection] ?? SHOTS[0];
      _sampledPos[0] = shot.position[0];
      _sampledPos[1] = shot.position[1];
      _sampledPos[2] = shot.position[2];
      _sampledTgt[0] = shot.target[0];
      _sampledTgt[1] = shot.target[1];
      _sampledTgt[2] = shot.target[2];
      lambda = 10;
    } else if (progress !== lastProgress.current) {
      // Input scroll aktif — pastikan rig "bangun" dan terus mengejar
      lastProgress.current = progress;
      settled.current = false;
      sampleShot(progress);
    } else {
      if (boardChanged) settled.current = false;
      if (settled.current) return; // tanpa input & sudah presisi → skip
      sampleShot(progress);
    }

    // Board terbuka (hero) — kamera menoleh ke kanan menyorot
    // chalkboard, menimpa pose hasil sampling; kembali ke shot
    // normal begitu board ditutup. Lambda dipelankan → pan sinematik.
    if (boardOpen && activeSection === "hero") {
      _sampledPos[0] = BOARD_OPEN_POS[0];
      _sampledPos[1] = BOARD_OPEN_POS[1];
      _sampledPos[2] = BOARD_OPEN_POS[2];
      _sampledTgt[0] = BOARD_OPEN_TGT[0];
      _sampledTgt[1] = BOARD_OPEN_TGT[1];
      _sampledTgt[2] = BOARD_OPEN_TGT[2];
      lambda = Math.min(lambda, 3);
    }

    desiredPos.current.set(
      _sampledPos[0],
      _sampledPos[1],
      _sampledPos[2]
    );
    desiredTarget.current.set(
      _sampledTgt[0],
      _sampledTgt[1],
      _sampledTgt[2]
    );

    // Damping eksponensial (frame-rate independent, delta di-clamp)
    const damp = 1 - Math.exp(-lambda * Math.min(delta, MAX_DELTA));
    camera.position.lerp(desiredPos.current, damp);
    lookTarget.current.lerp(desiredTarget.current, damp);

    // Gate lookAt berdasarkan sisa gerak: setelah benar-benar presisi,
    // update mikro (damp kecil tapi non-zero) tak lagi memutar kamera —
    // menghilangkan micro-jitter mantul di sekitar target.
    const motion =
      camera.position.distanceToSquared(desiredPos.current) +
      lookTarget.current.distanceToSquared(desiredTarget.current);

    if (motion > SETTLE_EPSILON || !settled.current) {
      camera.lookAt(lookTarget.current);
      if (motion < SETTLE_EPSILON) settled.current = true;
    }
  });

  return null;
}
