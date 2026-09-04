"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGLTF, Html } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useScrollStore } from "@/store/useScrollStore";
import { boardDrag } from "@/lib/boardDrag";
import {
  useBoardProjects,
  MAX_PAPERS,
  type BoardProject,
} from "@/lib/useBoardProjects";

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
 * - Kertas proyek dari content/projects/*.mdx (via useBoardProjects —
 *   JSON statis /projects-data, dikompilasi saat build) — jumlah
 *   mengikuti data (maks 12), penempatan seeded-random di region.
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
    z masing-masing dari RAYCUST SUDUT kertas (lihat BoardModel). */
const PAPER_W = 0.42;
const PAPER_H = 0.56;
/** Jarak minimum antar-pusat kertas (rejection sampling) */
const MIN_PAPER_DIST = 0.5;
/** Scan: step grid 0.18 (≈280 ray — resolusi region masih longgar)
    & chunk 60 ray per idle callback — scan berjalan di BACKGROUND
    (requestIdleCallback) tanpa memblokir gate/first render. */
const SCAN_STEP = 0.18;
const SCAN_CHUNK = 60;

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

/** requestIdleCallback dengan fallback timeout — scan jalan di luar
    jalur kritis mount (tidak menunda gate ENTER maupun frame pertama). */
function scheduleIdle(cb: () => void): number {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(cb, { timeout: 200 });
  }
  return window.setTimeout(cb, 50);
}
function cancelIdle(handle: number): void {
  if (typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

function BoardModel({
  onFitted,
  paperCount,
}: {
  onFitted?: (board: FittedBoard) => void;
  paperCount: number;
}) {
  const { scene } = useGLTF(BOARD_URL);
  const group = useRef<THREE.Group>(null);
  // Hasil fit (faceZ/width) — diisi layout effect, dibaca scan async
  const fitRef = useRef<{ faceZ: number; width: number } | null>(null);
  // Hasil scan (dipakai ulang saat paperCount berubah — scan CUMA SEKALI)
  const regionRef = useRef<WritableRegion | null>(null);
  const medianZRef = useRef(0);
  const scanDoneRef = useRef(false);

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

    // faceZ (fallback kasar) & lebar ter-fit — disimpan untuk scan
    const faceZ = (localMax.z - (localMin.z + localMax.z) / 2) * scale;
    const fittedWidth = (localMax.x - localMin.x) * scale;
    fitRef.current = { faceZ, width: fittedWidth };
    // Scan + placement JALAN TERPISAH di idle chunk (useEffect di bawah)
  }, [scene]);

  // -------------------------------------------------------------------
  // SCAN + PLACEMENT — chunked via requestIdleCallback (fallback
  // setTimeout 50ms): ±280 ray @60/chunk, bebas stall di jalur mount.
  // Gate (useProgress) dismiss saat asset termuat seperti biasa — scan
  // menyusul di background (±100–300ms), kertas pop-in saat siap.
  // -------------------------------------------------------------------
  useEffect(() => {
    const fit = fitRef.current;
    const g = group.current;
    if (!fit || !g) return;
    const parent = g.parent;
    if (!parent) return;
    const { faceZ, width: fittedWidth } = fit;
    // Matriks pasti current: dipanggil sekali di sini (scene statik)
    g.updateWorldMatrix(true, true);

    const raycaster = new THREE.Raycaster();
    raycaster.far = 40;
    const rayOrigin = new THREE.Vector3();
    const rayEnd = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    const hitLocal = new THREE.Vector3();
    const nrmWorld = new THREE.Vector3();
    const nrmParent = new THREE.Vector3();
    const invParent = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const meshNormal = new THREE.Matrix3();

    /** Ray di titik (x, y) parent-space → { z permukaan, menghadap
        penonton? } atau null. Alokasi nol per panggilan (buffer reuse). */
    const castAt = (
      x: number,
      y: number,
    ): { z: number; facing: boolean } | null => {
      rayOrigin.set(x, y, 10);
      parent.localToWorld(rayOrigin);
      rayEnd.set(x, y, 0);
      parent.localToWorld(rayEnd);
      rayDir.subVectors(rayEnd, rayOrigin).normalize();
      raycaster.set(rayOrigin, rayDir);
      const hit = raycaster.intersectObject(scene, true)[0];
      if (!hit || !hit.face) return null;
      hitLocal.copy(hit.point);
      parent.worldToLocal(hitLocal);
      meshNormal.getNormalMatrix(hit.object.matrixWorld);
      nrmWorld.copy(hit.face.normal).applyMatrix3(meshNormal).normalize();
      nrmParent.copy(nrmWorld).transformDirection(invParent);
      return { z: hitLocal.z, facing: nrmParent.z > 0.5 };
    };

    // Region fallback — dipakai bila scan gagal total (region netral).
    // Saat scan SUDAH selesai (paperCount berubah → effect re-run),
    // pakai hasil scan dari ref — scan CUMA SEKALI.
    let region: WritableRegion = scanDoneRef.current
      ? regionRef.current!
      : {
          minX: -fittedWidth / 2 + 0.3,
          maxX: fittedWidth / 2 - 0.3,
          minY: 1.0,
          maxY: 2.5,
          z: faceZ,
        };
    let medianZ = scanDoneRef.current ? medianZRef.current : faceZ;
    const samples: Array<{ x: number; y: number; z: number }> = [];

    // Grid sampel — precomputasi sekali (bukan per chunk)
    const xs: number[] = [];
    for (let sx = -fittedWidth / 2; sx <= fittedWidth / 2; sx += SCAN_STEP) {
      xs.push(sx);
    }
    const ys: number[] = [];
    for (let sy = 0.25; sy <= 2.7; sy += SCAN_STEP) {
      ys.push(sy);
    }
    const cols = xs.length;
    const total = cols * ys.length;

    const finish = () => {
      // Region writable — bounds + median z dari sampel yang lolos
      if (samples.length > 0) {
        const xs2 = samples.map((s) => s.x);
        const ys2 = samples.map((s) => s.y);
        const zs = samples.map((s) => s.z).sort((a, b) => a - b);
        medianZ = zs[Math.floor(zs.length / 2)];
        region = {
          minX: Math.min(...xs2),
          maxX: Math.max(...xs2),
          minY: Math.min(...ys2),
          maxY: Math.max(...ys2),
          z: medianZ,
        };
        // Simpan utk re-run placement (paperCount berubah → tanpa
        // ray ulang grid penuh)
        regionRef.current = region;
        medianZRef.current = medianZ;
        scanDoneRef.current = true;
      }

      // PLACEMENT — seeded-random dalam region; z per kertas = RAYCUST
      // 5 TITIK (4 sudut footprint ± rotasi + pusat) → ambil permukaan
      // TERDEPAN dari penonton (z parent terbesar). Bidang datar pada
      // titik terdepan tak mungkin menembus permukaan yang hanya
      // "turun" menjauhi kamera; tilt x ±0.05 rad menggeser bidang
      // ±0.014 — tercakup epsilon 1.5cm.
      const papers: PaperPlacement[] = [];
      const rng = mulberry32(1337);
      const loX = region.minX + PAPER_W / 2 + 0.05;
      const hiX = region.maxX - PAPER_W / 2 - 0.05;
      const loY = region.minY + PAPER_H / 2 + 0.04;
      const hiY = region.maxY - PAPER_H / 2 - 0.04;
      const wideEnough = hiX - loX > 0.1;
      const tallEnough = hiY - loY > 0.1;
      const corners: Array<[number, number]> = [
        [PAPER_W / 2, PAPER_H / 2],
        [-PAPER_W / 2, PAPER_H / 2],
        [PAPER_W / 2, -PAPER_H / 2],
        [-PAPER_W / 2, -PAPER_H / 2],
        [0, 0], // pusat — konfirmasi murah
      ];
      /** z permukaan TERDEPAN (maks z parent) pada footprint kertas. */
      const frontZ = (cx: number, cy: number, rotZ: number): number => {
        const c = Math.cos(rotZ);
        const s = Math.sin(rotZ);
        let front = -Infinity;
        for (const [lx, ly] of corners) {
          const h = castAt(cx + lx * c - ly * s, cy + lx * s + ly * c);
          if (h && h.z > front) front = h.z;
        }
        return front === -Infinity ? medianZ : front;
      };

      const minDist =
        paperCount <= 4
          ? MIN_PAPER_DIST
          : Math.max(0.34, MIN_PAPER_DIST * Math.sqrt(4 / paperCount));
      // Fallback grid mengikuti jumlah kertas (2×2 / 3×2 / 3×3 / 4×3 …)
      const fbCols = paperCount <= 4 ? 2 : Math.ceil(Math.sqrt(paperCount));
      const fbRows = Math.ceil(paperCount / fbCols);

      for (let i = 0; i < paperCount; i++) {
        // Posisi: rejection sampling (jarak ≥ minDist), fallback
        // even-grid — sama seperti sebelumnya.
        let px = 0;
        let py = 0;
        let placed = false;
        if (wideEnough && tallEnough) {
          for (let attempt = 0; attempt < 40; attempt++) {
            const cx = loX + rng() * (hiX - loX);
            const cy = loY + rng() * (hiY - loY);
            if (
              papers.every(
                (p) => Math.hypot(cx - p.x, cy - p.y) >= minDist,
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
          const col = i % fbCols;
          const row = Math.floor(i / fbCols);
          px = wideEnough
            ? loX + col * ((hiX - loX) / Math.max(1, fbCols - 1))
            : (region.minX + region.maxX) / 2;
          py = tallEnough
            ? loY + row * ((hiY - loY) / Math.max(1, fbRows - 1))
            : (region.minY + region.maxY) / 2;
        }
        // Rotasi & kemiringan — dari PRNG, satu tarikan per kertas
        const rotZ = (rng() * 12 - 6) * (Math.PI / 180); // ±6°
        const tiltX = rng() * 0.1 - 0.05; // ±0.05 rad
        // Corner-ray attach + re-try: permukaan menonjol > 12cm di atas
        // median → spot terlalu "bergelombang" untuk kertas datar —
        // geser dengan PRNG (maks 3 re-try), lalu terima apa adanya.
        let pz = frontZ(px, py, rotZ);
        let nudges = 0;
        while (pz - region.z > 0.12 && nudges < 3 && wideEnough && tallEnough) {
          const cx = loX + rng() * (hiX - loX);
          const cy = loY + rng() * (hiY - loY);
          if (
            papers.every(
              (p) => Math.hypot(cx - p.x, cy - p.y) >= MIN_PAPER_DIST * 0.8,
            )
          ) {
            px = cx;
            py = cy;
          }
          pz = frontZ(px, py, rotZ);
          nudges += 1;
        }
        papers.push({ x: px, y: py, z: pz + 0.015, rotZ, tiltX });
      }

      onFitted?.({ region, width: fittedWidth, papers });
      // Kertas masuk scene → StaticShadows bake ulang (+400ms). Ini
      // juga terjadi di dalam jendela gate (gate menunggu semua asset).
      window.dispatchEvent(new Event("chalkboard:papers"));
      // Diagnostik ukur (dev saja)
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          "[Chalkboard] region =",
          `x[${region.minX.toFixed(2)}, ${region.maxX.toFixed(2)}]`,
          `y[${region.minY.toFixed(2)}, ${region.maxY.toFixed(2)}]`,
          "z(median) =", region.z.toFixed(3),
          "| faceZ(bbox) =", faceZ.toFixed(3),
          "| width =", fittedWidth.toFixed(3),
          "| papers =",
          papers
            .map(
              (p) =>
                `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, z ${p.z.toFixed(2)})`,
            )
            .join(" "),
        );
      }
    };

    // Scan CUMA SEKALI: re-run karena paperCount berubah (fetch data
    // datang) → langsung placement dari region tersimpan, tanpa ray
    // ulang grid penuh.
    if (scanDoneRef.current) {
      finish();
      return () => {};
    }

    // Chunk loop — maks 60 ray per idle callback, lalu jadwalkan lagi.
    // Seluruh sisa pekerjaan di luar jalur mount; tiap callback ≤ ~2ms.
    let idx = 0;
    let handle = 0;
    let cancelled = false;
    // Saat gerbang dibuka (fade GSAP 750ms mulai), scan DITAHAN 400ms —
    // requestIdleCallback bisa saja menyisipkan chunk di tengah tween
    // (idle callback tetap menyala saat main thread "sibuk" animasi).
    // Jendela 0–750ms pasca-klik = bebas kerja berat.
    let paused = false;
    const onGateDismissed = () => {
      paused = true;
      cancelIdle(handle);
      window.setTimeout(() => {
        paused = false;
        if (!cancelled && idx < total) handle = scheduleIdle(step);
      }, 400);
    };
    window.addEventListener("gate:dismissed", onGateDismissed);
    const step = () => {
      if (cancelled) return;
      if (paused) {
        handle = scheduleIdle(step); // diam sampai pause lewat
        return;
      }
      const end = Math.min(idx + SCAN_CHUNK, total);
      while (idx < end) {
        const x = xs[idx % cols];
        const y = ys[Math.floor(idx / cols)];
        const hit = castAt(x, y);
        if (hit && hit.facing && hit.z > faceZ - 0.4) {
          samples.push({ x, y, z: hit.z });
        }
        idx += 1;
      }
      if (idx < total) {
        handle = scheduleIdle(step);
      } else {
        finish(); // scan tuntas → placement + onFitted
        window.removeEventListener("gate:dismissed", onGateDismissed);
      }
    };
    handle = scheduleIdle(step);

    return () => {
      cancelled = true;
      cancelIdle(handle);
      window.removeEventListener("gate:dismissed", onGateDismissed);
    };
    // paperCount dalam deps: fetch projects menaikkan count → effect
    // re-run → scanDoneRef short-circuit → placement ulang cepat.
  }, [onFitted, scene, paperCount]);

  // Shadow: tiap mesh ikut casting — perlakuan sama dengan Avatar.
  // Sambil memberi tahu StaticShadows bahwa papan sudah ADA di scene —
  // bake bayangan pertama yang MENGHITUNG papan jalan di jendela gate
  // (bukan tepat di klik gerbang).
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
    window.dispatchEvent(new Event("chalkboard:fitted"));
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
    placement + raycast); data proyek dari hook (MDX content/projects).
    KLIK tidak di sini: resolver di depannya (BoardClickProxy) yang
    memutuskan via e.intersections — kertas hanya perlu
    userData.projectId. */
function QuestPaper({
  project,
  x,
  y,
  z,
  rotZ,
  tiltX,
}: {
  project: Pick<BoardProject, "id" | "title" | "year">;
  x: number;
  y: number;
  z: number;
  rotZ: number;
  tiltX: number;
}) {
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
      <meshStandardMaterial map={texture} roughness={0.96} metalness={0} />
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

  // Proyek dari content/projects/*.mdx (JSON statis /projects-data).
  // Belum termuat / kosong → 0 kertas (papan polos, tanpa crash).
  const { projects } = useBoardProjects();
  const paperCount = Math.min(projects.length, MAX_PAPERS);

  // Bbox papan ter-fit — null selama model belum termuat/ter-fit.
  const [board, setBoard] = useState<FittedBoard | null>(null);

  // Resolver: tepat di depan kertas terjauh (max z + 8cm), memeluk
  // region writable — pusat & ukuran mengikuti region (clamped ke
  // lebar papan × 0.9 dan tinggi 2.6). Guard: 0 kertas (data belum
  // termuat) → Math.max(...[]) = -Infinity; pakai median region.
  const proxyZ = board
    ? (board.papers.length > 0
        ? Math.max(...board.papers.map((p) => p.z))
        : board.region.z) + 0.08
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
          <BoardModel onFitted={setBoard} paperCount={paperCount} />
        </Suspense>

        {/* Kertas quest — acak-ter-seed di region writable, z dari
            raycast di spot final masing-masing; datanya dari
            content/projects/*.mdx (maks MAX_PAPERS) */}
        {board &&
          projects.slice(0, paperCount).map((project, i) => {
            const paper = board.papers[i];
            if (!paper) return null;
            return (
              <QuestPaper
                key={project.id}
                project={project}
                x={paper.x}
                y={paper.y}
                z={paper.z}
                rotZ={paper.rotZ}
                tiltX={paper.tiltX}
              />
            );
          })}

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
        intensity={6}
        decay={2}
        distance={9}
        color="#ffd9a6"
        castShadow={false}
      />
    </group>
  );
}
