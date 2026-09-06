"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SHOTS, SHOTS_COMPACT } from "@/data/shots";
import { tierRefs } from "@/hooks/useViewportTier";
import type { SectionId } from "@/store/useScrollStore";
import { useScrollStore } from "@/store/useScrollStore";
import { boardDrag } from "@/lib/boardDrag";

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

// Refs tier viewport (non-rerender) — store tunggal modul
// hooks/useViewportTier: portrait → tabel shot & pose board compact,
// coarse → ambang drag/pan berbeda. Dibaca di useFrame/event handler
// TANPA memicu render ulang.
const portraitRef = tierRefs.portrait;
const coarseRef = tierRefs.coarse;

// Porsi segmen untuk "menetap" di tiap shot sebelum bergerak
const HOLD = 0.4;

// Pose kamera saat project board terbuka (hero + boardOpen): kamera
// hanya berputar/bergoyang ke kanan dari titik awalnya — papan berdiri
// di spoke 90° kanan (6.2, 0, 6.0; lihat Chalkboard.tsx), jadi cukup
// yaw ~80° untuk memframanya penuh.
const BOARD_OPEN_POS: [number, number, number] = [3.2, 1.9, 4.6];
const BOARD_OPEN_TGT: [number, number, number] = [12.8, 1.35, 0.2];
// Pose open COMPACT — mundur lebih jauh & lebih tinggi: layar portrait
// sempit + FOV horizontal kecil membuat papan makin besar di frame.
// Target x 12.46 (solve NDC round 5): papan tepat di TENGAH layar
// (center NDC x 0.001; tepi ±0.49, pojok kertas ±0.55 — semua in-frame).
const BOARD_OPEN_POS_C: [number, number, number] = [1.4, 2.25, 7.0];
const BOARD_OPEN_TGT_C: [number, number, number] = [12.46, 1.45, 0.4];

// Pose inspeksi papan (boardInspect): dolly-in dari pose open — kamera
// merapat ke wajah papan sampai grid 2×2 kertas mengisi ~70% frame.
// Papan: pos (12.8, 0, 0.2) rot -1.1, tinggi 2.8. Posisi ±1.9 unit di
// depan pose open ke arah wajah papan; target sedikit di atas tengah
// wajah papan (grid kertas terpusat, tepi atas tak terpotong).
// Pose inspeksi desktop — FRONTAL murni terhadap wajah papan (papan
// dirotasi -1.1 rad → normal wajah ≈ (-0.89, 0, 0.45); kamera berdiri
// di sepanjang normal, ±3.4 m dari pusat papan): tidak ada kemiringan
// serong, seluruh papan + kertas terlihat lurus.
const BOARD_INSPECT_POS: [number, number, number] = [10.13, 1.7, 1.6];
const BOARD_INSPECT_TGT: [number, number, number] = [12.8, 1.45, 0.2];

// Tangent wajah papan — arah "kanan-layar" bagi penonton yang menghadap
// papan (cross(up, −normal) dengan normal (-0.891, 0, 0.454)). Dipakai
// parallax kursor saat inspeksi: kursor kanan → kamera geser kanan.
const BOARD_TX = -0.454;
const BOARD_TZ = -0.891;

// Pose inspeksi COMPACT — mundur lebih jauh (layar sempit + FOV sama
// membuat papan lebih besar di frame) dan lebih tinggi sedikit agar
// grid 2×2 kertas terjadi di tengah frame vertikal.
const BOARD_INSPECT_POS_C: [number, number, number] = [9.2, 1.8, 2.1];
const BOARD_INSPECT_TGT_C: [number, number, number] = [12.8, 1.42, 0.2];

// Waypoint busur: saat membuka/menutup board, kamera LEWAT DULU di
// depan karakter (sedikit ke kiri + maju) — gerakan "melingkar dari
// kamera depan" — baru menoleh ke kanan ke arah papan. Tatapan selama
// leg ini tetap ke arah avatar.
const BOARD_FRONT_POS: [number, number, number] = [-0.6, 1.65, 5.4];
const BOARD_FRONT_TGT: [number, number, number] = [0, 1.35, 0];

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
  // Tabel shot per-tier — SATU titik pemilihan (portrait = compact).
  // Desktop mengambil SHOTS persis seperti sebelumnya.
  const table = portraitRef.current ? SHOTS_COMPACT : SHOTS;
  const segCount = table.length - 1;
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

  const from = table[seg];
  const to = table[seg + 1];

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

  // Tier viewport — refs non-rerender dari hooks/useViewportTier (satu
  // set matchMedia di level modul): reduced-motion mematikan scrub,
  // portrait memilih pose board compact, coarse mengubah ambang drag.
  const reducedMotion = tierRefs.reducedMotion;

  // Velocity-gate: ref pointer input & status settle (bebas alokasi,
  // nilai skalar — reassign ref bukan alokasi objek)
  const lastProgress = useRef(-1);
  const lastSection = useRef<SectionId>("hero");
  // Parallax kursor saat inspeksi papan — dilacak global (pointermove
  // pasif), offset RELATIF terhadap normal wajah papan: kursor kanan →
  // kamera geser kanan-tangkapan, kursor atas → naik. Aktif HANYA di
  // fase inspect; amplitudo kecil supaya framing tetap terjaga.
  const parallaxX = useRef(0); // -1..1 (kiri→kanan layar)
  const parallaxY = useRef(0); // -1..1 (atas→bawah layar)
  // Pan drag inspeksi — user men-drag canvas → pandangan bergeser
  // (grab-style), terbatas agar papan tidak nyasar dari frame.
  const panX = useRef(0);
  const panY = useRef(0);
  const dragActive = useRef(false);
  const dragLastX = useRef(0);
  const dragLastY = useRef(0);
  const dragMovedDist = useRef(0);

  // Drag-pan papan: pointerdown pada canvas saat boardOpen (BUKAN saat
  // boardInspect — pointerdown dari klik yang MEMASUKKI inspeksi terjadi
  // sebelum flag inspect terpasang, yang di-set saat click = pointerup;
  // kalau nunggu inspect, press-drag satu gerakan tak pernah engage).
  // Drag menggeser pandangan sepanjang tangent & vertikal (ter-clamp).
  // Drag bermakna saat belum inspeksi = PROMOSI ke inspeksi (8px fine /
  // 14px coarse); boardDrag.moved menekan klik di akhir drag (drag bukan
  // klik).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const st = useScrollStore.getState();
      if (!st.boardOpen) {
        boardDrag.moved = false;
        return;
      }
      if (!(e.target instanceof HTMLCanvasElement)) return;
      dragActive.current = true;
      dragLastX.current = e.clientX;
      dragLastY.current = e.clientY;
      dragMovedDist.current = 0;
      boardDrag.moved = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragActive.current) return;
      const dx = e.clientX - dragLastX.current;
      const dy = e.clientY - dragLastY.current;
      dragLastX.current = e.clientX;
      dragLastY.current = e.clientY;
      dragMovedDist.current += Math.abs(dx) + Math.abs(dy);
      const st = useScrollStore.getState();
      // Tekan-and-drag dari papan terbuka: FINE pointer saja yang
      // di-promosi ke inspeksi (desktop: drag = zoom, perilaku lama).
      // COARSE TIDAK promosi — swipe kiri harus tetap jadi gesture
      // keluar (laporan HP: "swipe kiri selalu zoom terus"); inspeksi
      // di layar sentuh = TAP kertas, bukan drag.
      const PROMOTE_AT = coarseRef.current ? 14 : 8;
      if (
        !coarseRef.current &&
        dragMovedDist.current > PROMOTE_AT &&
        st.boardOpen &&
        !st.boardInspect
      ) {
        st.setBoardInspect(true);
        boardDrag.moved = true;
      }
      const DRAG_MOVED_THRESHOLD = coarseRef.current ? 8 : 14;
      if (dragMovedDist.current > DRAG_MOVED_THRESHOLD) boardDrag.moved = true;
      // Pan hanya bermakna saat inspeksi
      if (!st.boardInspect) return;
      // Pandangan mengikuti arah drag (push-style) — clamp per-tier:
      // Pada layar mobile portrait (layar sempit vertikal), batas horizontal
      // diperluas (±1.75m) agar pengguna dapat menggeser sampai ke ujung
      // kertas & sudut papan paling kiri dan paling kanan.
      const isPortrait = portraitRef.current;
      const isCoarse = coarseRef.current;
      const PAN_CLAMP_X = isPortrait ? 1.75 : (isCoarse ? 1.2 : 0.6);
      const PAN_CLAMP_Y = isPortrait ? 0.8 : 0.6;
      const panSpeed = (isPortrait || isCoarse) ? 0.0028 : 0.0016;

      panX.current = Math.max(
        -PAN_CLAMP_X,
        Math.min(PAN_CLAMP_X, panX.current + dx * panSpeed),
      );
      panY.current = Math.max(
        -PAN_CLAMP_Y,
        Math.min(PAN_CLAMP_Y, panY.current + dy * panSpeed),
      );
    };
    const onUp = () => {
      dragActive.current = false;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      parallaxX.current = (e.clientX / window.innerWidth) * 2 - 1;
      parallaxY.current = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () =>
      window.removeEventListener("pointermove", onPointerMove);
  }, []);
  // Fase pan board: "closed" → "front" (waypoint depan karakter) →
  // "open" → (boardInspect) "inspect". Pan SELALU membusur lewat depan
  // karakter. Masuk/keluar inspeksi = dolly langsung antar pose.
  type Side = "closed" | "front" | "open" | "inspect";
  const boardPhase = useRef<Side>("closed");
  const lastBoardOpen = useRef(false);
  const lastBoardInspect = useRef(false);
  const settled = useRef(false);

  useFrame((_, delta) => {
    const { progress, activeSection, boardOpen, boardInspect } =
      useScrollStore.getState();

    let lambda = 4; // responsif tapi lembut (mode normal)

    if (reducedMotion.current) {
      // Reduced motion: tanpa scrub/interpolasi & tanpa busur — shot
      // statis per section (+ pose board langsung), settle pendek.
      const boardChanged =
        boardOpen !== lastBoardOpen.current ||
        boardInspect !== lastBoardInspect.current;
      lastBoardOpen.current = boardOpen;
      lastBoardInspect.current = boardInspect;
      boardPhase.current = boardOpen
        ? boardInspect
          ? "inspect"
          : "open"
        : "closed";
      if (
        settled.current &&
        activeSection === lastSection.current &&
        !boardChanged &&
        !dragActive.current // drag berjalan → jangan skip (pan harus masuk)
      )
        return;
      if (activeSection !== lastSection.current) {
        lastSection.current = activeSection;
        settled.current = false;
      }
      if (boardChanged) settled.current = false;
      // Keluar inspeksi → pan drag di-reset
      if (!boardInspect) {
        panX.current = 0;
        panY.current = 0;
      }
      const table = portraitRef.current ? SHOTS_COMPACT : SHOTS;
      const shot = table.find((s) => s.id === activeSection) ?? table[0];
      _sampledPos[0] = shot.position[0];
      _sampledPos[1] = shot.position[1];
      _sampledPos[2] = shot.position[2];
      _sampledTgt[0] = shot.target[0];
      _sampledTgt[1] = shot.target[1];
      _sampledTgt[2] = shot.target[2];
      if (boardOpen && activeSection === "hero") {
        const P = boardInspect
          ? portraitRef.current
            ? BOARD_INSPECT_POS_C
            : BOARD_INSPECT_POS
          : portraitRef.current
            ? BOARD_OPEN_POS_C
            : BOARD_OPEN_POS;
        const T = boardInspect
          ? portraitRef.current
            ? BOARD_INSPECT_TGT_C
            : BOARD_INSPECT_TGT
          : portraitRef.current
            ? BOARD_OPEN_TGT_C
            : BOARD_OPEN_TGT;
        _sampledPos[0] = P[0];
        _sampledPos[1] = P[1];
        _sampledPos[2] = P[2];
        _sampledTgt[0] = T[0];
        _sampledTgt[1] = T[1];
        _sampledTgt[2] = T[2];
        // Pan drag user — tangent papan (drag = input eksplisit)
        _sampledPos[0] += BOARD_TX * panX.current;
        _sampledPos[2] += BOARD_TZ * panX.current;
        _sampledPos[1] += panY.current;
        _sampledTgt[0] += BOARD_TX * panX.current;
        _sampledTgt[2] += BOARD_TZ * panX.current;
        _sampledTgt[1] += panY.current;
      }
      lambda = 10;
    } else {
      // Transisi fase — busur lewat waypoint depan; inspeksi = dolly
      // langsung antar pose open ↔ inspect.
      if (
        boardOpen &&
        boardPhase.current !== "front" &&
        boardPhase.current !== "open" &&
        boardPhase.current !== "inspect"
      ) {
        boardPhase.current = "front";
        settled.current = false;
      } else if (
        !boardOpen &&
        (boardPhase.current === "open" || boardPhase.current === "inspect")
      ) {
        boardPhase.current = "front"; // menutup: kembali lewat depan
        settled.current = false;
      } else if (boardOpen && boardInspect && boardPhase.current === "open") {
        boardPhase.current = "inspect";
        settled.current = false;
      } else if (
        boardOpen &&
        !boardInspect &&
        boardPhase.current === "inspect"
      ) {
        boardPhase.current = "open";
        settled.current = false;
      }

      // Jika papan tidak terbuka dan sudah scroll meninggalkan hero,
      // paksa fase closed langsung agar kamera bebas mengikuti section.
      if (!boardOpen && (activeSection !== "hero" || progress > 0.02)) {
        boardPhase.current = "closed";
      }

      // Di tengah busur → jangan pernah skip update kamera.
      if (boardPhase.current === "front") settled.current = false;

      if (progress !== lastProgress.current) {
        // Input scroll aktif — pastikan rig "bangun" dan terus mengejar
        lastProgress.current = progress;
        settled.current = false;
        sampleShot(progress);
      } else if (!settled.current) {
        sampleShot(progress);
      }
      // (Compact framing kini murni via SHOTS_COMPACT di sampleShot.)

      // Keluar inspeksi → pan drag di-reset
      if (!boardInspect) {
        panX.current = 0;
        panY.current = 0;
      }

      // Pilih GOAL pan (menimpa hasil sampling shot):
      if (boardPhase.current === "front") {
        // Leg 1: ke waypoint di depan karakter; tatapan tetap ke arah
        // avatar — kamera "melingkar" sebelum menoleh ke papan.
        _sampledPos[0] = BOARD_FRONT_POS[0];
        _sampledPos[1] = BOARD_FRONT_POS[1];
        _sampledPos[2] = BOARD_FRONT_POS[2];
        _sampledTgt[0] = BOARD_FRONT_TGT[0];
        _sampledTgt[1] = BOARD_FRONT_TGT[1];
        _sampledTgt[2] = BOARD_FRONT_TGT[2];
        lambda = Math.min(lambda, 3);
        // Cukup dekat waypoint → fase berikutnya mengikuti store
        const dx = camera.position.x - BOARD_FRONT_POS[0];
        const dy = camera.position.y - BOARD_FRONT_POS[1];
        const dz = camera.position.z - BOARD_FRONT_POS[2];
        if (dx * dx + dy * dy + dz * dz < 0.35) {
          boardPhase.current = boardOpen
            ? boardInspect
              ? "inspect"
              : "open"
            : "closed";
          settled.current = false;
        }
      } else if (boardOpen && activeSection === "hero") {
        // Leg 2 / inspeksi PAPAN (kanan): goal mengikuti store.
        const P = boardInspect
          ? portraitRef.current
            ? BOARD_INSPECT_POS_C
            : BOARD_INSPECT_POS
          : portraitRef.current
            ? BOARD_OPEN_POS_C
            : BOARD_OPEN_POS;
        const T = boardInspect
          ? portraitRef.current
            ? BOARD_INSPECT_TGT_C
            : BOARD_INSPECT_TGT
          : portraitRef.current
            ? BOARD_OPEN_TGT_C
            : BOARD_OPEN_TGT;
        _sampledPos[0] = P[0];
        _sampledPos[1] = P[1];
        _sampledPos[2] = P[2];
        _sampledTgt[0] = T[0];
        _sampledTgt[1] = T[1];
        _sampledTgt[2] = T[2];
        // Pan drag user — offset sepanjang tangent papan.
        _sampledPos[0] += BOARD_TX * panX.current;
        _sampledPos[2] += BOARD_TZ * panX.current;
        _sampledPos[1] += panY.current;
        _sampledTgt[0] += BOARD_TX * panX.current;
        _sampledTgt[2] += BOARD_TZ * panX.current;
        _sampledTgt[1] += panY.current;
        lambda = dragActive.current ? 12 : Math.min(lambda, 3);
      }
      // Fase "closed": goal = pose shot hasil sampling (perilaku normal).
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
