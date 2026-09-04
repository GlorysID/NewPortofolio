"use client";

import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useScrollStore } from "@/store/useScrollStore";
import {
  useCertificates,
  MAX_CERTS,
  type Certificate,
} from "@/lib/useCertificates";
import { certDrag } from "@/lib/certDrag";

/**
 * CertificateWall — dinding sertifikat di spoke KIRI, mirror eksak
 * quest board (pos −12.8, rot +1.1). Dinding datar (tanpa surface
 * scan — plane datar diketahui), kertas sertifikat ditempatkan
 * seeded-random (mulberry32 seed 4242) dengan rejection sampling di
 * area wajah dinding.
 *
 * - Kertas = plane landscape 0.72×0.51: texture gambar sertifikat
 *   ASLI (TextureLoader async, dispose saat unmount) + caption strip
 *   canvas di bawah gambar (issuer + year, gaya label quest).
 * - castShadow=false untuk dinding & kertas (hard rule).
 * - Klik kertas → activeCertId (quest window 2D). Klik dinding kosong
 *   → toggle inspect (certInspect). Resolver proxy plane di depan
 *   dinding membaca e.intersections (pola BoardClickProxy) + protokol
 *   certDrag.moved (drag ≠ klik, mirror boardDrag).
 * - Affordance Html saat certWallOpen && !certInspect && !activeCertId.
 * - Statik: nol pekerjaan per-frame.
 */

const WALL_POS: [number, number, number] = [-12.8, 0, 0.2];
const WALL_ROT_Y = 1.1;
/** Ukuran wajah dinding (m) — sedikit lebih besar dari papan. */
const WALL_W = 4.4;
const WALL_H = 3.2;
/** Kertas sertifikat — landscape A4-ish (m). */
const CERT_W = 0.72;
const CERT_H = 0.51;
/** Caption strip di bawah gambar (fraksi tinggi kertas). */
const CAPTION_FRAC = 0.18;
const MIN_DIST = 0.85;
/** Tinggi pusat area penempatan kertas (dinding 3.2 m, area tengah). */
const AREA_CY = 1.85;
const AREA_H = 2.3;

/** mulberry32 — PRNG deterministik (pola quest board, seed beda). */
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

/** Caption strip kertas sertifikat — canvas: issuer + year (gaya label
    quest paper: warm paper, mono coklat). Dipakai sebagai bagian BAWAH
    texture gabungan per kertas. */
function drawCertCaption(
  issuer: string,
  year: string,
): HTMLCanvasElement {
  const W = 512;
  const H = Math.round(512 * (CERT_H * CAPTION_FRAC) / (CERT_W * (1 - CAPTION_FRAC)));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(32, 32, 31, 0.14)";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = "#20201f";
  ctx.font = "bold 40px serif";
  ctx.textBaseline = "top";
  const text = issuer.length > 26 ? `${issuer.slice(0, 25)}…` : issuer;
  ctx.fillText(text, 36, 26);
  ctx.fillStyle = "rgba(111, 90, 57, 0.85)";
  ctx.font = "30px monospace";
  ctx.fillText(year, 36, 84);
  return canvas;
}

/** Satu kertas sertifikat — gambar asli (atas) + caption (bawah) dalam
    SATU texture gabungan per kertas (canvas atas + bawah digambar ke
    kanvas 512×H penuh). Image dimuat async → needsUpdate. */
function CertificateCard({
  cert,
  x,
  y,
  z,
  rotZ,
  tiltX,
}: {
  cert: Certificate;
  x: number;
  y: number;
  z: number;
  rotZ: number;
  tiltX: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setActiveCertId = useScrollStore((s) => s.setActiveCertId);

  // Texture gabungan: gambar sertifikat (object-cover) di atas +
  // caption strip di bawah — satu canvas, satu texture, nol mesh ekstra.
  const texture = useMemo(() => {
    const W = 512;
    const imgH = Math.round(W * ((CERT_H * (1 - CAPTION_FRAC)) / CERT_W));
    const capCanvas = drawCertCaption(cert.issuer, cert.year);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = imgH + capCanvas.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0, 0, W, canvas.height);
      // Placeholder tone area gambar (layout stabil sejak frame pertama)
      ctx.fillStyle = "#e7e0d2";
      ctx.fillRect(0, 0, W, imgH);
      ctx.drawImage(capCanvas, 0, imgH);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cert.issuer, cert.year]);

  useEffect(() => () => texture.dispose(), [texture]);

  // Muat gambar sertifikat (async) → draw object-cover ke area atas
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      const canvas = texture.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const imgH = Math.round(W * ((CERT_H * (1 - CAPTION_FRAC)) / CERT_W));
      const scale = Math.max(W / img.naturalWidth, imgH / img.naturalHeight);
      const sw = W / scale;
      const sh = imgH / scale;
      ctx.drawImage(
        img,
        (img.naturalWidth - sw) / 2,
        (img.naturalHeight - sh) / 2,
        sw,
        sh,
        0,
        0,
        W,
        imgH,
      );
      ctx.strokeStyle = "rgba(32, 32, 31, 0.18)";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, imgH - 4);
      texture.needsUpdate = true;
    };
    img.src = cert.image;
    return () => {
      cancelled = true;
    };
  }, [cert.image, texture]);

  // Unmount/HMR — cursor cleanup
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  const onOver = () => {
    const st = useScrollStore.getState();
    if (!st.certWallOpen) return;
    document.body.style.cursor = "pointer";
    if (meshRef.current) {
      gsapSafeScale(meshRef.current, 1.04);
    }
  };

  const onOut = () => {
    const st = useScrollStore.getState();
    if (!st.certWallOpen) return;
    document.body.style.cursor = "";
    if (meshRef.current) {
      gsapSafeScale(meshRef.current, 1);
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={[x, y, z]}
      rotation={[tiltX, 0, rotZ]}
      castShadow={false}
      receiveShadow
      userData={{ certId: cert.id }}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (certDrag.moved) {
          certDrag.moved = false;
          return;
        }
        const st = useScrollStore.getState();
        if (!st.certInspect) {
          st.setCertInspect(true);
          return;
        }
        setActiveCertId(cert.id);
      }}
    >
      <planeGeometry args={[CERT_W, CERT_H]} />
      <meshStandardMaterial map={texture} roughness={0.92} metalness={0} />
    </mesh>
  );
}

/** Scale tween helper — dipanggil dari handler event (bukan per-frame). */
function gsapSafeScale(mesh: THREE.Mesh, target: number) {
  gsap.to(mesh.scale, {
    x: target,
    y: target,
    z: 1,
    duration: 0.25,
    ease: "power2.out",
    overwrite: true,
  });
}

/** Resolver klik dinding — proxy transparan di depan kertas terjauh.
    Klik area kosong dinding saat inspect = keluar inspeksi (mirror
    BoardClickProxy). */
function WallClickProxy({ z }: { z: number }) {
  return (
    <mesh
      position={[0, AREA_CY, z]}
      rotation={[0, 0, 0]}
      onPointerOver={() => {
        const st = useScrollStore.getState();
        if (st.certWallOpen && !st.certInspect)
          document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (certDrag.moved) {
          certDrag.moved = false;
          return;
        }
        const st = useScrollStore.getState();
        if (!st.certWallOpen) return;
        if (!st.certInspect) {
          st.setCertInspect(true);
          return;
        }
        const certHit = e.intersections.find(
          (hit) =>
            hit.object !== e.object &&
            typeof hit.object.userData?.certId === "string",
        );
        if (certHit) {
          st.setActiveCertId(certHit.object.userData.certId as string);
        } else {
          st.setCertInspect(false);
        }
      }}
    >
      <planeGeometry args={[WALL_W * 0.9, WALL_H * 0.85]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function CertificateWall() {
  const certWallOpen = useScrollStore((s) => s.certWallOpen);
  const certInspect = useScrollStore((s) => s.certInspect);
  const activeCertId = useScrollStore((s) => s.activeCertId);
  const { certificates } = useCertificates();
  const certs = certificates.slice(0, MAX_CERTS);
  const showAffordance = certWallOpen && !certInspect && !activeCertId;

  // Penempatan seeded-random dalam wajah dinding (datar — z konstanta).
  const placements = useMemo(() => {
    const rng = mulberry32(4242);
    const loX = -WALL_W / 2 + CERT_W / 2 + 0.12;
    const hiX = WALL_W / 2 - CERT_W / 2 - 0.12;
    const loY = AREA_CY - AREA_H / 2 + CERT_H / 2 + 0.1;
    const hiY = AREA_CY + AREA_H / 2 - CERT_H / 2 - 0.1;
    const out: Array<{ x: number; y: number; rotZ: number; tiltX: number }> = [];
    for (let i = 0; i < certs.length; i++) {
      let px = 0;
      let py = 0;
      let placed = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const cx = loX + rng() * (hiX - loX);
        const cy = loY + rng() * (hiY - loY);
        if (
          out.every((p) => Math.hypot(cx - p.x, cy - p.y) >= MIN_DIST)
        ) {
          px = cx;
          py = cy;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Fallback grid — baris menjorok (brick layout) di dalam area
        const cols = Math.max(1, Math.floor((hiX - loX) / MIN_DIST) + 1);
        const col = i % cols;
        const row = Math.floor(i / cols);
        px = loX + col * ((hiX - loX) / Math.max(1, cols - 1));
        py = loY + row * ((hiY - loY) / Math.max(1, Math.ceil(certs.length / cols) - 1));
      }
      out.push({
        x: px,
        y: py,
        rotZ: (rng() * 6 - 3) * (Math.PI / 180), // ±3°
        tiltX: rng() * 0.06 - 0.03, // ±0.03 rad
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates.length]);

  return (
    <group position={WALL_POS} rotation={[0, WALL_ROT_Y, 0]}>
      {/* Dinding — wood/cork gelap; receiveShadow (bukan caster) */}
      <mesh position={[0, WALL_H / 2, 0]} receiveShadow castShadow={false}>
        <boxGeometry args={[WALL_W, WALL_H, 0.12]} />
        <meshStandardMaterial color="#17120c" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Bingkai tipis kayu gelap — 4 batang box hairline di tepi */}
      <mesh position={[0, WALL_H + 0.03, 0.02]} castShadow={false}>
        <boxGeometry args={[WALL_W + 0.12, 0.06, 0.16]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.03, 0.02]} castShadow={false}>
        <boxGeometry args={[WALL_W + 0.12, 0.06, 0.16]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>
      <mesh position={[WALL_W / 2 + 0.03, WALL_H / 2, 0.02]} castShadow={false}>
        <boxGeometry args={[0.06, WALL_H + 0.12, 0.16]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>
      <mesh position={[-WALL_W / 2 - 0.03, WALL_H / 2, 0.02]} castShadow={false}>
        <boxGeometry args={[0.06, WALL_H + 0.12, 0.16]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>

      {/* Kertas sertifikat — child group dinding (ikut rotasi) */}
      {certs.map((cert, i) => {
        const p = placements[i];
        if (!p) return null;
        return (
          <CertificateCard
            key={cert.id}
            cert={cert}
            x={p.x}
            y={p.y}
            z={0.08}
            rotZ={p.rotZ}
            tiltX={p.tiltX}
          />
        );
      })}

      {/* Resolver klik dinding — di depan kertas terjauh */}
      <WallClickProxy z={0.2} />

      {/* Affordance — label layar kecil di atas dinding */}
      {showAffordance && (
        <Html position={[0, WALL_H + 0.35, 0]} center zIndexRange={[10, 0]}>
          <div
            aria-hidden
            className="pointer-events-none select-none whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.28em] text-white/60"
          >
            Klik dinding untuk melihat sertifikat
          </div>
        </Html>
      )}
    </group>
  );
}
