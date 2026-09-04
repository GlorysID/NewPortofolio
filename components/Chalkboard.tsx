"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGLTF, Html } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { BOARD_PROJECTS } from "@/data/projects";
import { useScrollStore } from "@/store/useScrollStore";
import { boardDrag } from "@/lib/boardDrag";

/**
 * Chalkboard — papan proyek 3D bergaya QUEST BOARD MMORPG.
 *
 * Perlakuan render SAMA dengan Avatar (Avatar.tsx):
 * - Auto-fit: skala dihitung dari bounding box (tinggi target 2.8 m,
 *   bottom di y=0) — bukan angka scale manual.
 * - castShadow=true per mesh → key directional light memunculkan
 *   bayangan sungguhan; tekstur/material asli glb tidak diopresi.
 * - Loading `useGLTF` polos, Suspense agar enter gate (drei
 *   useProgress) menunggu model ini.
 * - Cahaya: beam studio + kerucut + kolam di LightingRig.tsx.
 *
 * LAPISAN QUEST BOARD (baru):
 * - 4 kertas proyek (BOARD_PROJECTS) di grid 2×2 pada wajah papan —
 *   tekstur kertas digambar via <canvas> sekali di useMemo (judul
 *   tinta gelap, garis aksen, tahun; font generic canvas 2D — tanpa
 *   asset font baru), di-dispose saat unmount (pola ContactGlow).
 *   castShadow=false (hard rule), receiveShadow=true — beam papan
 *   memberi kedalaman. Rotasi/jitter deterministik (SSR-safe, tanpa
 *   Math.random) + rotation.x kecil agar tiap kertas menangkap cahaya
 *   sedikit berbeda (ilusi lengkung tanpa biaya geometri).
 * - Interaksi: SATU bidang resolver transparan di depan segalanya
 *   (BoardClickProxy) menangkap SEMUA klik papan — tidak bergantung
 *   pada kedalaman wajah model glb. Klik saat belum inspeksi → masuk
 *   inspeksi; klik saat inspeksi → resolver membaca e.intersections
 *   untuk menemukan kertas di belakangnya (userData.projectId) dan
 *   membuka quest window-nya. Hover kertas = cursor pointer + scale
 *   tween GSAP (handler hover di kertas tetap menerima event walau
 *   ada proxy di depan — R3F men-dispatch ke semua objek yang
 *   beririsan, kecuali yang di-stop propagation).
 * - Statik: nol pekerjaan per-frame selain tween hover saat disentuh.
 */

/** Tinggi papan di scene (meter) — acuan auto-fit (pola Avatar.tsx). */
const BOARD_HEIGHT = 2.8;
const BOARD_URL = "/models/chalkboard.glb";

/** Grid kertas 2×2 — koordinat board-local TER-FIT (papan menghadap
    +z lokal). Kertas 0.42×0.56 (diperkecil ~35% dari 0.62×0.82 —
    ukuran lama terbaca sebagai kartu raksasa lepas, bukan catatan
    tersemat); kolom ±0.42, baris 1.85/1.15 — grid terpusat di area
    tulis dengan margin dari bingkai; clamp defensif terhadap lebar/
    tinggi ter-fit di runtime. z per slot = hasil RAYCAST ke permukaan
    nyata (bukan bbox) + epsilon 0.01 → menempel di permukaan apa adanya. */
const PAPER_W = 0.42;
const PAPER_H = 0.56;
const COLS = [-0.42, 0.42];
const ROWS = [1.85, 1.15];
/** Rotasi z (°) & jitter posisi per kertas — tetap per index (SSR-safe). */
const PAPER_ROT_Z = [-3.5, 2.5, -2, 4];
const PAPER_JITTER: Array<[number, number]> = [
  [0.02, 0.03],
  [-0.03, -0.02],
  [0.03, -0.03],
  [-0.02, 0.02],
];
/** Kemiringan rotation.x per kertas (rad) — menangkap cahaya beda. */
const PAPER_TILT_X = [-0.05, 0.06, 0.045, -0.06];

/** Ukuran papan ter-fit + z permukaan per slot — dilaporkan BoardModel
    setelah auto-fit (ruang group luar: x/z ter-center, bottom y=0,
    tinggi 2.8). slotZ diukur via RAYCAST ke mesh model: permukaan
    terdepan pada titik slot itu (wajah tulis/bingkai), BUKAN bbox —
    bug sebelumnya: faceZ dari bbox maxZ mencakup bingkai/kaki yang
    menonjol → kertas melayang di udara depan papan. */
interface FittedBoard {
  /** Fallback: max z ter-fit (bbox) — dipakai bila ray slot meleset */
  faceZ: number;
  /** z permukaan nyata per slot kertas (urutan BOARD_PROJECTS) */
  slotZ: [number, number, number, number];
  /** Lebar papan ter-fit (untuk clamp grid & lebar resolver) */
  width: number;
}

function BoardModel({
  onFitted,
}: {
  onFitted?: (board: FittedBoard) => void;
}) {
  const { scene } = useGLTF(BOARD_URL);
  const group = useRef<THREE.Group>(null);

  // Auto-fit (pola Avatar) — dengan satu koreksi penting: Box3.
  // setFromObject mengukur dalam RUANG DUNIA, dan parent group ini
  // memiliki transform (position [13,0,0] + rotasi) — bukan identitas
  // seperti Avatar. Hasil ukur dikonversi ke ruang LOKAL via inversi
  // matrixWorld sebelum dipakai, kalau tidak papan "nyasar".
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);

    const worldBox = new THREE.Box3().setFromObject(g);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    // 8 sudut world box → ruang lokal g (titik tertransformasi eksak)
    const corners = [
      new THREE.Vector3(worldBox.min.x, worldBox.min.y, worldBox.min.z),
      new THREE.Vector3(worldBox.max.x, worldBox.min.y, worldBox.min.z),
      new THREE.Vector3(worldBox.min.x, worldBox.max.y, worldBox.min.z),
      new THREE.Vector3(worldBox.max.x, worldBox.max.y, worldBox.min.z),
      new THREE.Vector3(worldBox.min.x, worldBox.min.y, worldBox.max.z),
      new THREE.Vector3(worldBox.max.x, worldBox.min.y, worldBox.max.z),
      new THREE.Vector3(worldBox.min.x, worldBox.max.y, worldBox.max.z),
      new THREE.Vector3(worldBox.max.x, worldBox.max.y, worldBox.max.z),
    ].map((c) => c.applyMatrix4(inv));

    const localMin = new THREE.Vector3(
      Math.min(...corners.map((c) => c.x)),
      Math.min(...corners.map((c) => c.y)),
      Math.min(...corners.map((c) => c.z))
    );
    const localMax = new THREE.Vector3(
      Math.max(...corners.map((c) => c.x)),
      Math.max(...corners.map((c) => c.y)),
      Math.max(...corners.map((c) => c.z))
    );

    const sizeY = localMax.y - localMin.y;
    const scale = BOARD_HEIGHT / (sizeY || 1);
    g.scale.setScalar(scale);

    // Bottom ke y=0, center x/z ke 0 — dalam ruang lokal (offset
    // g.position berada di ruang parent yang dirotasi; karena anchor
    // yang kita inginkan adalah titik origin group, cukup koreksi
    // center hasil skala — rotasi parent diterapkan setelahnya).
    const cx = ((localMin.x + localMax.x) / 2) * scale;
    const cz = ((localMin.z + localMax.z) / 2) * scale;
    g.position.set(-cx, -localMin.y * scale, -cz);

    // faceZ (fallback) = max z ter-fit = D/2 setelah centering
    const faceZ = (localMax.z - (localMin.z + localMax.z) / 2) * scale;
    const fittedWidth = (localMax.x - localMin.x) * scale;

    // -----------------------------------------------------------------
    // RAYCAST-TO-SURFACE — z permukaan NYATA per slot kertas. Bbox maxZ
    // mencakup bagian yang paling menonjol (bingkai/kaki); wajah tulis
    // biasanya RESES di dalamnya → kertas di faceZ melayang. Solusi:
    // lempar ray dari depan (z +10) ke arah −z tepat di titik slot,
    // ambil hit terdekat = permukaan pada spot itu, z kertas = hit + 1cm.
    // Sekali saat mount, deterministik, bebas biaya runtime.
    // -----------------------------------------------------------------
    g.updateWorldMatrix(true, true); // matriks g + parent + anak: current
    const parent = g.parent;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 40;
    const rayOrigin = new THREE.Vector3();
    const rayEnd = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    const hitLocal = new THREE.Vector3();
    const slotZ: [number, number, number, number] = [faceZ, faceZ, faceZ, faceZ];
    for (let i = 0; i < 4; i++) {
      const col = COLS[i % 2];
      const row = ROWS[Math.floor(i / 2)];
      if (!parent) break;
      // Origin & arah ray di ruang DUNIA, dari koordinat slot di ruang
      // group luar (parent g = tempat kertas diparent-kan).
      rayOrigin.set(col, row, 10);
      parent.localToWorld(rayOrigin);
      rayEnd.set(col, row, 0);
      parent.localToWorld(rayEnd);
      rayDir.subVectors(rayEnd, rayOrigin).normalize();
      raycaster.set(rayOrigin, rayDir);
      const hits = raycaster.intersectObject(scene, true);
      if (hits.length > 0) {
        // Hit terdekat = permukaan terdepan pada titik slot; konversi
        // balik ke ruang group luar → z untuk penempatan kertas.
        hitLocal.copy(hits[0].point);
        parent.worldToLocal(hitLocal);
        slotZ[i] = hitLocal.z + 0.01; // epsilon anti z-fight
      }
      // Meleset → fallback faceZ (sudah terisi di awal)
    }

    onFitted?.({ faceZ, slotZ, width: fittedWidth });
    // Diagnostik ukur (dev saja): bukti permukaan slot ≠ bbox maxZ —
    // bila semua slotZ < faceZ, wajah tulis memang reses di dalam bbox.
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[Chalkboard] faceZ(bbox) =", faceZ.toFixed(3),
        "| slotZ(ray) =", slotZ.map((z) => z.toFixed(3)).join(", "),
        "| width =", fittedWidth.toFixed(3),
      );
    }
    // scene termasuk deps: glb baru (identitas scene beda) harus
    // di-refit + di-raycast ulang, bukan sekali selamanya.
  }, [onFitted, scene]);

  // Shadow: tiap mesh ikut casting — perlakuan sama dengan Avatar.
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
  }, [scene]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

/** Gambar satu kertas quest ke canvas 2D — judul tinta, garis aksen,
    tahun. Font generic ("serif"/"monospace") — tanpa asset baru.
    Dipanggil sekali per kertas (useMemo) → CanvasTexture. */
function drawPaperTexture(title: string, year: string): HTMLCanvasElement {
  const W = 512;
  const H = 676; // rasio ≈ 0.62 : 0.82
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Kertas warm — plus tepi gelap tipis (kertas dipotong)
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(32, 32, 31, 0.14)";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  // Tanda pin di atas-tengah
  ctx.beginPath();
  ctx.arc(W / 2, 46, 13, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(32, 32, 31, 0.28)";
  ctx.fill();

  // Judul — serif tebal, word-wrap maksimal 4 baris
  ctx.fillStyle = "#20201f";
  ctx.font = "bold 54px serif";
  ctx.textBaseline = "top";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 96 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  shown.forEach((l, i) => ctx.fillText(l, 48, 118 + i * 66));

  // Garis aksen hangat di bawah judul
  const titleBottom = 118 + shown.length * 66 + 18;
  ctx.fillStyle = "#e8a33d";
  ctx.fillRect(48, titleBottom, 150, 8);

  // Label "QUEST" kecil + tahun di kaki kertas
  ctx.font = "28px monospace";
  ctx.fillStyle = "rgba(111, 90, 57, 0.85)";
  ctx.fillText("QUEST", 48, H - 92);
  ctx.fillText(year, 48, H - 54);

  return canvas;
}

/** Satu kertas proyek — mesh + tekstur canvas + hover. Posisi x/y/z
    sudah dihitung & di-clamp di Chalkboard (grid + raycast slot z).
    KLIK tidak di sini: resolver di depannya (BoardClickProxy) yang
    memutuskan via e.intersections — kertas hanya perlu
    userData.projectId. */
function QuestPaper({
  index,
  x,
  y,
  z,
}: {
  index: number;
  x: number;
  y: number;
  z: number;
}) {
  const project = BOARD_PROJECTS[index];
  const meshRef = useRef<THREE.Mesh>(null);

  // Tekstur dibuat SEKALI per kertas; di-dispose saat unmount
  // (pola ContactGlow — tidak ada kebocoran memori GPU).
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(
      drawPaperTexture(project.title, project.year),
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.title, project.year]);

  useEffect(() => () => texture.dispose(), [texture]);

  const [jx, jy] = PAPER_JITTER[index];

  const onOver = () => {
    const { boardInspect } = useScrollStore.getState();
    if (!boardInspect) return;
    document.body.style.cursor = "pointer";
    if (meshRef.current) {
      gsap.to(meshRef.current.scale, {
        x: 1.05,
        y: 1.05,
        z: 1,
        duration: 0.25,
        ease: "power2.out",
        overwrite: true,
      });
    }
  };

  const onOut = () => {
    const { boardInspect } = useScrollStore.getState();
    if (!boardInspect) return;
    document.body.style.cursor = "";
    if (meshRef.current) {
      gsap.to(meshRef.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.3,
        ease: "power2.out",
        overwrite: true,
      });
    }
  };

  // Unmount/HMR — pastikan cursor tidak nyangkut
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  return (
    <mesh
      ref={meshRef}
      position={[x + jx, y + jy, z]}
      rotation={[PAPER_TILT_X[index], 0, (PAPER_ROT_Z[index] * Math.PI) / 180]}
      castShadow={false}
      receiveShadow
      userData={{ projectId: project.id }}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      <planeGeometry args={[PAPER_W, PAPER_H]} />
      <meshStandardMaterial map={texture} roughness={0.92} metalness={0} />
    </mesh>
  );
}

/** Resolver klik papan — bidang transparan di depan kertas terjauh
    (max slotZ + 0.08), ukurannya memeluk papan (di-clamp ke lebar
    ter-fit). Semua klik papan lewat sini:
    - belum inspeksi → masuk inspeksi (dolly-in kamera)
    - saat inspeksi → baca e.intersections: kertas di belakang proxy
      yang tertabrak (userData.projectId) membuka quest window-nya;
      klik area papan kosong → keluar inspeksi (kembali ke pan normal).
    Alur lengkap: open → inspeksi → quest (klik kertas) → inspeksi
    (Tutup/ESC) → pan normal (klik area kosong papan). */
function BoardClickProxy({
  z,
  w,
  h,
}: {
  z: number;
  w: number;
  h: number;
}) {
  return (
    <mesh
      position={[0, 1.5, z]}
      rotation={[0, 0, 0]}
      onPointerOver={() => {
        const { boardInspect } = useScrollStore.getState();
        if (!boardInspect) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        // Akhir drag-pan = BUKAN klik; tekan flag dan reset.
        if (boardDrag.moved) {
          boardDrag.moved = false;
          return;
        }
        const { boardInspect, setBoardInspect, setActiveProjectId } =
          useScrollStore.getState();
        if (!boardInspect) {
          setBoardInspect(true);
          return;
        }
        // Inspeksi: cari kertas yang tertabrak di belakang proxy —
        // intersections terurut terdekat; lewati proxy sendiri.
        const paperHit = e.intersections.find(
          (hit) =>
            hit.object !== e.object &&
            typeof hit.object.userData?.projectId === "string",
        );
        if (paperHit) {
          setActiveProjectId(paperHit.object.userData.projectId as string);
        } else {
          // Klik di luar kertas = keluar inspeksi (kembali ke pan normal)
          setBoardInspect(false);
        }
      }}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function Chalkboard() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const boardInspect = useScrollStore((s) => s.boardInspect);
  const activeProjectId = useScrollStore((s) => s.activeProjectId);
  const showAffordance = boardOpen && !boardInspect && !activeProjectId;

  // Bbox papan ter-fit — null selama model belum termuat/ter-fit.
  const [board, setBoard] = useState<FittedBoard | null>(null);

  // Grid slot final — x/y di-clamp defensif terhadap dimensi ter-fit
  // (grid wajib tetap di papan), z dari RAYCAST permukaan per slot.
  const halfW = board ? board.width / 2 : 0;
  const maxCol = Math.max(0.2, halfW - PAPER_W / 2 - 0.08);
  const minRow = PAPER_H / 2 + 0.2;
  const maxRow = BOARD_HEIGHT - PAPER_H / 2 - 0.2;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const slots = BOARD_PROJECTS.map((_, i) => ({
    x: clamp(COLS[i % 2], -maxCol, maxCol),
    y: clamp(ROWS[Math.floor(i / 2)], minRow, maxRow),
    z: board ? board.slotZ[i] : 0,
  }));
  // Resolver: di depan kertas terjauh + 8cm, memeluk papan (lebar
  // di-clamp ke 90% lebar ter-fit, tinggi 2.6 dari total 2.8).
  const proxyZ = board ? Math.max(...board.slotZ) + 0.08 : 0;
  const proxyW = board ? Math.min(2.2, Math.max(1.2, board.width * 0.9)) : 2.2;

  return (
    <group>
      {/* Papan — auto-fit tinggi 2.8 m; penempatan & rotasi hadap di
          sini. Kamera (0,·,6.2) sudutnya, karakter lurus di depan,
          papan di spoke kanan yang dimundurkan ke z=0. */}
      <group position={[12.8, 0, 0.2]} rotation={[0, -1.1, 0]}>
        <Suspense fallback={null}>
          <BoardModel onFitted={setBoard} />
        </Suspense>

        {/* Kertas quest — 2×2 di permukaan nyata papan (raycast per
            slot; x/y di-clamp ke dimensi ter-fit) */}
        {board &&
          BOARD_PROJECTS.map((_, i) => (
            <QuestPaper
              key={i}
              index={i}
              x={slots[i].x}
              y={slots[i].y}
              z={slots[i].z}
            />
          ))}

        {/* Resolver klik — bidang transparan di depan kertas terjauh */}
        {board && (
          <BoardClickProxy z={proxyZ} w={proxyW} h={2.6} />
        )}

        {/* Affordance "lihat dekat" — label layar kecil di atas papan,
            hanya saat papan menghadap kita & belum inspeksi. Non-transform
            (screen-space), pointer-events-none — murni petunjuk. */}
        {showAffordance && (
          <Html position={[0, 3.15, 0]} center zIndexRange={[10, 0]}>
            <div
              aria-hidden
              className="pointer-events-none select-none whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.28em] text-white/60"
            >
              Klik papan untuk melihat lebih dekat
            </div>
          </Html>
        )}
      </group>
      {/* Aksen hangat wajah papan — world space, arah kamera board-open
          (castShadow false — hard rule: tanpa shadow caster tambahan) */}
      <pointLight
        position={[11.7, 2, 0.1]}
        intensity={12}
        decay={2}
        distance={9}
        color="#ffd9a6"
        castShadow={false}
      />
    </group>
  );
}
