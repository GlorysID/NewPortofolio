"use client";

import { Suspense } from "react";
import { Html, useGLTF } from "@react-three/drei";

/**
 * Chalkboard — papan proyek 3D di sisi kanan panggung.
 *
 * Placement (metric dari gltf-transform inspect):
 * - Model kecil: bbox ≈ 0.93 × 0.72 × 0.41 unit, kaki di y=0 →
 *   di-scale 4.2× menjadi papan berdiri ≈ 3.9 × 3.0 m, ditempatkan
 *   di kanan avatar (x≈3.3), sedikit diputar agar permukaannya
 *   menghadap pose kamera "board open" (lihat CameraRig.tsx).
 * - Loading: `useGLTF` polos — geometri TIDAK draco (ekstensi
 *   hanya EXT_texture_webp, didukung native three.js). Bungkus
 *   Suspense supaya useProgress (enter gate) menunggu model ini.
 * - Konten proyek: drei <Html transform occlude> dipatok ke
 *   permukaan papan (world space, offset kecil ke arah normal) —
 *   daftar proyek gaya kapur, row = link sungguhan.
 * - Cahaya: satu aksen hangat untuk keterbacaan — castShadow false
 *   (aturan keras: tidak menambah shadow caster baru).
 * - Statis: nol pekerjaan per-frame; semua transform statis.
 */

const PROJECTS = [
  {
    index: "01",
    name: "Interactive Data Atlas",
    desc: "Visualisasi data geospasial real-time berbasis WebGL.",
    link: "#",
  },
  {
    index: "02",
    name: "Generative Brand Studio",
    desc: "Tool generatif identitas visual untuk brand kecil.",
    link: "#",
  },
  {
    index: "03",
    name: "Spatial UI Prototype",
    desc: "Eksperimen antarmuka spasial di WebXR.",
    link: "#",
  },
];

function BoardModel() {
  const { scene } = useGLTF("/models/chalkboard.glb");
  return <primitive object={scene} />;
}

export default function Chalkboard() {
  return (
    <group>
      {/* Papan fisik — kanan panggung, menghadap pose kamera board-open */}
      <group
        position={[3.3, 0, -0.6]}
        rotation={[0, -0.3, 0]}
        scale={4.2}
      >
        <Suspense fallback={null}>
          <BoardModel />
        </Suspense>
        {/* Aksen hangat khusus papan (castShadow false — hard rule) */}
        <pointLight
          position={[0.15, 0.85, 0.5]}
          intensity={12}
          decay={2}
          distance={9}
          color="#ffd9a6"
          castShadow={false}
        />
      </group>

      {/* Daftar proyek "kapur" — dipatok ke permukaan papan.
          pointer-events-auto diperlukan: ancestor canvas adalah
          pointer-events-none (Experience wrapper). */}
      <Suspense fallback={null}>
        <Html
          transform
          occlude
          position={[3.06, 1.55, 0.2]}
          rotation={[0, -0.3, 0]}
          scale={0.55}
          wrapperClass="pointer-events-auto"
        >
          <div
            style={{ width: 360, pointerEvents: "auto" }}
            className="rounded-sm border border-[#2b332d] bg-[#101613]/95 p-5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)]"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#e8a33d]">
              Selected Work — Papan Proyek
            </p>
            <ul className="mt-3 divide-y divide-white/10">
              {PROJECTS.map((project) => (
                <li key={project.name} className="py-3">
                  <span className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                    {project.index}
                  </span>
                  <a
                    href={project.link}
                    className="mt-0.5 block font-display text-[17px] leading-snug text-white/90 underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#e8a33d]"
                  >
                    {project.name}
                  </a>
                  <p className="mt-1 font-body text-[11px] leading-relaxed text-white/60">
                    {project.desc}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35">
              Swipe kiri / ← untuk kembali
            </p>
          </div>
        </Html>
      </Suspense>
    </group>
  );
}
