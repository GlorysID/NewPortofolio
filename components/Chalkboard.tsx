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

/** Kertas quest — ukuran dalam ruang ter-fit. Posisi/rotasi BUKAN
    konstanta: area papan dianalisis dulu (scan ray per sampel), lalu
    4 kertas ditempatkan acak-ter-seed DI DALAM region writable, dengan
    z masing-masing diraycast ke permukaan nyata (lihat BoardModel). */
const PAPER_W = 0.42;
const PAPER_H = 0.56;
/** Jarak minimum antar-pusat kertas (rejection sampling) */
const MIN_PAPER_DIST = 0.5;

/** Hasil analisis papan ter-fit — dilaporkan BoardModel sekali di
    mount (ruang group luar: x/z ter-center, bottom y=0, tinggi 2.8).
    region = area papan yang BENAR-BENAR bisa memuat kertas, diukur via
    scan ray (wajah menghadap penonton; kaki/badan/bingkai dalam
    tereliminasi); papers = posisi final ter-seed + z permukaan. */
interface WritableRegion {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Median z permukaan region — fallback kedalaman */
  z: number;
}
interface PaperPlacement {
  x: number;
  y: number;
  z: number;
  /** Rotasi z acak (rad, ±6°) */
  rotZ: number;
  /** Kemiringan x (rad, ±0.05) — penangkap cahaya */
  tiltX: number;
}
interface FittedBoard {
  region: WritableRegion;
  width: number;
  papers: PaperPlacement[];
}

/** mulberry32 — PRNG deterministik untuk penempatan kertas. Seed tetap
    → hasil "acak" identik di setiap load/HMR/re-render (tanpa
    Math.random — SSR-safe & stabil seperti konstanta). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

    // faceZ (fallback kasar) = max z ter-fit = D/2 setelah centering
    const faceZ = (localMax.z - (localMin.z + localMax.z) / 2) * scale;
    const fittedWidth = (localMax.x - localMin.x) * scale;

    // -----------------------------------------------------------------
    // SURFACE SCAN — peta area papan yang BENAR-BENAR bisa memuat
    // kertas. Grid sampel ray (step 0.12): x melintasi lebar ter-fit,
    // y 0.25–2.7. Sampel WRITABLE bila: ada hit, normal wajah menghadap
    // penonton (z > 0.5 di ruang parent), dan bukan geometri dalam
    // (hit.z > faceZ − 0.4). Bug "nembus kebawah" berasal dari slot
    // TETAP yang mengenai kaki/badan/bingkai bawah — scan mengukur
    // area writable-nya secara langsung, bukan menebak.
    // -----------------------------------------------------------------
    g.updateWorldMatrix(true, true); // matriks g + parent + anak: current
    const parent = g.parent;
    let region: WritableRegion = {
      minX: -fittedWidth / 2 + 0.3,
      maxX: fittedWidth / 2 - 0.3,
      minY: 1.0,
      maxY: 2.5,
      z: faceZ,
    };
    let medianZ = faceZ;
    if (parent) {
      const raycaster = new THREE.Raycaster();
      raycaster.far = 40;
      const rayOrigin = new THREE.Vector3();
      const rayEnd = new THREE.Vector3();
      const rayDir = new THREE.Vector3();
      const hitLocal = new THREE.Vector3();
      const nrmWorld = new THREE.Vector3();
      const nrmParent = new THREE.Vector3();
      const invParent = new THREE.Matrix4()
        .copy(parent.matrixWorld)
        .invert();
      const meshNormal = new THREE.Matrix3();

      const samples: Array<{ x: number; y: number; z: number }> = [];
      const step = 0.12;
      for (let sx = -fittedWidth / 2; sx <= fittedWidth / 2; sx += step) {
        for (let sy = 0.25; sy <= 2.7; sy += step) {
          rayOrigin.set(sx, sy, 10);
          parent.localToWorld(rayOrigin);
          rayEnd.set(sx, sy, 0);
          parent.localToWorld(rayEnd);
          rayDir.subVectors(rayEnd, rayOrigin).normalize();
          raycaster.set(rayOrigin, rayDir);
          const hit = raycaster.intersectObject(scene, true)[0];
          if (!hit || !hit.face) continue;
          // Normal wajah hit: lokal mesh → dunia (normal matrix mesh),
          // lalu dunia → ruang parent (transformDirection invers parent)
          // — ruang tempat kertas diparent-kan; wajah tulis menghadap
          // +z parent (arah penonton).
          meshNormal.getNormalMatrix(hit.object.matrixWorld);
          nrmWorld.copy(hit.face.normal).applyMatrix3(meshNormal).normalize();
          nrmParent.copy(nrmWorld).transformDirection(invParent);
          hitLocal.copy(hit.point);
          parent.worldToLocal(hitLocal);
          if (nrmParent.z > 0.5 && hitLocal.z > faceZ - 0.4) {
            samples.push({ x: sx, y: sy, z: hitLocal.z });
          }
        }
      }

      if (samples.length > 0) {
        const xs = samples.map((s) => s.x);
        const ys = samples.map((s) => s.y);
        const zs = samples.map((s) => s.z).sort((a, b) => a - b);
        medianZ = zs[Math.floor(zs.length / 2)];
        region = {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          z: medianZ,
        };
      }
    }

    // -----------------------------------------------------------------
    // PLACEMENT — 4 kertas acak-ter-seed DI DALAM region writable.
    // Rejection sampling: jarak antar-pusat ≥ MIN_PAPER_DIST; ≤40 coba;
    // gagal → fallback even-grid 2×2 di dalam region. z final kertas:
    // raycast TEPAT di titik terpilih + 1cm (fallback region.z / median).
    // Seed tetap 1337 → deterministik lintas load/HMR/re-render; tekstur
    // kertas (memoized per index) tetap stabil menghadap pasangan-nya.
    // -----------------------------------------------------------------
    const papers: PaperPlacement[] = [];
    {
      const rng = mulberry32(1337);
      const loX = region.minX + PAPER_W / 2 + 0.05;
      const hiX = region.maxX - PAPER_W / 2 - 0.05;
      const loY = region.minY + PAPER_H / 2 + 0.04;
      const hiY = region.maxY - PAPER_H / 2 - 0.04;
      const raycaster = new THREE.Raycaster();
      raycaster.far = 40;
      const rayOrigin = new THREE.Vector3();
      const rayEnd = new THREE.Vector3();
      const rayDir = new THREE.Vector3();
      const hitLocal = new THREE.Vector3();
      const castZ = (x: number, y: number): number => {
        if (!parent) return medianZ;
        rayOrigin.set(x, y, 10);
        parent.localToWorld(rayOrigin);
        rayEnd.set(x, y, 0);
        parent.localToWorld(rayEnd);
        rayDir.subVectors(rayEnd, rayOrigin).normalize();
        raycaster.set(rayOrigin, rayDir);
        const hit = raycaster.intersectObject(scene, true)[0];
        if (hit) {
          hitLocal.copy(hit.point);
          parent.worldToLocal(hitLocal);
          return hitLocal.z + 0.01; // epsilon anti z-fight
        }
        return medianZ;
      };
      const wideEnough = hiX - loX > 0.1;
      const tallEnough = hiY - loY > 0.1;
      for (let i = 0; i < 4; i++) {
        let px = 0;
        let py = 0;
        let placed = false;
        if (wideEnough && tallEnough) {
          for (let attempt = 0; attempt < 40; attempt++) {
            const cx = loX + rng() * (hiX - loX);
            const cy = loY + rng() * (hiY - loY);
            if (
              papers.every(
                (p) => Math.hypot(cx - p.x, cy - p.y) >= MIN_PAPER_DIST,
              )
            ) {
              px = cx;
              py = cy;
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          // Fallback even-grid 2×2 di dalam region (deterministik)
          const col = i % 2;
          const row = Math.floor(i / 2);
          px = wideEnough
            ? loX + col * (hiX - loX)
            : (region.minX + region.maxX) / 2;
          py = tallEnough
            ? loY + row * (hiY - loY)
            : (region.minY + region.maxY) / 2;
        }
        papers.push({
          x: px,
          y: py,
          z: castZ(px, py),
          rotZ: (rng() * 12 - 6) * (Math.PI / 180), // ±6°
          tiltX: rng() * 0.1 - 0.05, // ±0.05 rad
        });
      }
    }

    onFitted?.({ region, width: fittedWidth, papers });
    // Diagnostik ukur (dev saja): bukti region writable ≠ bbox/area
    // penuh — bila minY region jauh di atas 0.25, area kaki/bawah
    // memang tereliminasi dari kandidat kertas.
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[Chalkboard] region =",
        `x[${region.minX.toFixed(2)}, ${region.maxX.toFixed(2)}]`,
        `y[${region.minY.toFixed(2)}, ${region.maxY.toFixed(2)}]`,
        "z(median) =", region.z.toFixed(3),
        "| faceZ(bbox) =", faceZ.toFixed(3),
        "| width =", fittedWidth.toFixed(3),
        "| papers =",
        papers.map(
          (p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, z ${p.z.toFixed(2)})`,
        ).join(" "),
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

/** Satu kertas proyek — mesh + tekstur canvas + hover. Posisi, rotasi,
    dan z permukaan sudah ditentukan analisis papan (region + seeded
    placement + raycast). KLIK tidak di sini: resolver di depannya
    (BoardClickProxy) yang memutuskan via e.intersections — kertas
    hanya perlu userData.projectId. */
function QuestPaper({
  index,
  x,
  y,
  z,
  rotZ,
  tiltX,
}: {
  index: number;
  x: number;
  y: number;
  z: number;
  rotZ: number;
  tiltX: number;
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
      position={[x, y, z]}
      rotation={[tiltX, 0, rotZ]}
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
  x,
  y,
}: {
  z: number;
  w: number;
  h: number;
  x: number;
  y: number;
}) {
  return (
    <mesh
      position={[x, y, z]}
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

  // Resolver: tepat di depan kertas terjauh (max z + 8cm), memeluk
  // region writable — pusat & ukuran mengikuti region (clamped ke
  // lebar papan × 0.9 dan tinggi 2.6).
  const proxyZ = board
    ? Math.max(...board.papers.map((p) => p.z)) + 0.08
    : 0;
  const proxyW = board
    ? Math.min(
        board.width * 0.9,
        (board.region.maxX - board.region.minX) + 0.6,
      )
    : 2.2;
  const proxyH = board
    ? Math.min(2.6, (board.region.maxY - board.region.minY) + 0.5)
    : 2.6;
  const proxyX = board
    ? (board.region.minX + board.region.maxX) / 2
    : 0;
  const proxyY = board
    ? (board.region.minY + board.region.maxY) / 2
    : 1.5;
  // Label "lihat dekat": di atas region writable (bukan di atas bbox —
  // region bisa lebih rendah dari papan penuh).
  const labelY = board
    ? Math.min(board.region.maxY + 0.25, 3.15)
    : 3.15;
  const labelX = proxyX;

  return (
    <group>
      {/* Papan — auto-fit tinggi 2.8 m; penempatan & rotasi hadap di
          sini. Kamera (0,·,6.2) sudutnya, karakter lurus di depan,
          papan di spoke kanan yang dimundurkan ke z=0. */}
      <group position={[12.8, 0, 0.2]} rotation={[0, -1.1, 0]}>
        <Suspense fallback={null}>
          <BoardModel onFitted={setBoard} />
        </Suspense>

        {/* Kertas quest — acak-ter-seed di region writable, z dari
            raycast di spot final masing-masing */}
        {board &&
          board.papers.map((paper, i) => (
            <QuestPaper
              key={i}
              index={i}
              x={paper.x}
              y={paper.y}
              z={paper.z}
              rotZ={paper.rotZ}
              tiltX={paper.tiltX}
            />
          ))}

        {/* Resolver klik — bidang transparan mengikuti region */}
        {board && (
          <BoardClickProxy z={proxyZ} w={proxyW} h={proxyH} x={proxyX} y={proxyY} />
        )}

        {/* Affordance "lihat dekat" — label layar kecil di atas region
            writable papan, hanya saat papan menghadap kita & belum
            inspeksi. Non-transform (screen-space), pointer-events-none. */}
        {showAffordance && (
          <Html position={[labelX, labelY, 0]} center zIndexRange={[10, 0]}>
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
