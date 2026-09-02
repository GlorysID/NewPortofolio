"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF, Html } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { BOARD_PROJECTS } from "@/data/projects";
import { useScrollStore } from "@/store/useScrollStore";

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

/** Grid kertas 2×2 — koordinat board-local (papan menghadap +z lokal).
    Kertas 0.62×0.82; kolom ±0.52, baris atas/bawah; z 0.06 = kertas
    "tersemat" sedikit melayang di depan wajah (bayangan pin nyata). */
const PAPER_W = 0.62;
const PAPER_H = 0.82;
const PAPER_Z = 0.06;
const COLS = [-0.52, 0.52];
const ROWS = [2.18, 1.26];
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

function BoardModel() {
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
  }, []);

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

/** Satu kertas proyek — mesh + tekstur canvas + hover. KLIK tidak di
    sini: resolver di depannya (BoardClickProxy) yang memutuskan via
    e.intersections — kertas hanya perlu userData.projectId. */
function QuestPaper({ index }: { index: number }) {
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

  const col = COLS[index % 2];
  const row = ROWS[Math.floor(index / 2)];
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
      position={[col + jx, row + jy, PAPER_Z]}
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

/** Resolver klik papan — bidang transparan DI DEPAN segalanya (z aman
    di luar kedalaman wajah glb mana pun). Semua klik papan lewat sini:
    - belum inspeksi → masuk inspeksi (dolly-in kamera)
    - saat inspeksi → baca e.intersections: kertas di belakang proxy
      yang tertabrak (userData.projectId) membuka quest window-nya;
      klik area papan kosong → keluar inspeksi (kembali ke pan normal).
    Alur lengkap: open → inspeksi → quest (klik kertas) → inspeksi
    (Tutup/ESC) → pan normal (klik area kosong papan). */
function BoardClickProxy() {
  return (
    <mesh
      position={[0, 1.72, 0.35]}
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
      <planeGeometry args={[2.7, 3.1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function Chalkboard() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const boardInspect = useScrollStore((s) => s.boardInspect);
  const activeProjectId = useScrollStore((s) => s.activeProjectId);
  const showAffordance = boardOpen && !boardInspect && !activeProjectId;

  return (
    <group>
      {/* Papan — auto-fit tinggi 2.8 m; penempatan & rotasi hadap di
          sini. Kamera (0,·,6.2) sudutnya, karakter lurus di depan,
          papan di spoke kanan yang dimundurkan ke z=0. */}
      <group position={[12.8, 0, 0.2]} rotation={[0, -1.1, 0]}>
        <Suspense fallback={null}>
          <BoardModel />
        </Suspense>

        {/* Kertas quest — grid 2×2 di wajah papan (board-local) */}
        {BOARD_PROJECTS.map((_, i) => (
          <QuestPaper key={i} index={i} />
        ))}

        {/* Resolver klik — bidang transparan di depan segalanya */}
        <BoardClickProxy />

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
