"use client";

import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";

/**
 * Chalkboard — papan proyek 3D, jauh di sisi kanan panggung.
 *
 * - Model kecil: bbox ≈ 0.93 × 0.72 × 0.41 unit, kaki di y=0 →
 *   di-scale 4.2× menjadi papan berdiri ≈ 3.9 × 3.0 m, ditempatkan
 *   di x≈6 (jauh kanan avatar), sedikit diputar agar permukaannya
 *   menghadap pose kamera "board open" (lihat BOARD_OPEN_* di
 *   CameraRig.tsx).
 * - Loading: `useGLTF` polos — geometri TIDAK draco (ekstensi
 *   hanya EXT_texture_webp, didukung native three.js). Bungkus
 *   Suspense supaya useProgress (enter gate) menunggu model ini.
 * - TANPA konten DOM apa pun di atas papan (permintaan user):
 *   hanya model 3D + cahaya aksen hangat (castShadow false —
 *   aturan keras: tidak menambah shadow caster baru).
 * - Statis: nol pekerjaan per-frame; semua transform statis.
 */

function BoardModel() {
  const { scene } = useGLTF("/models/chalkboard.glb");
  return <primitive object={scene} />;
}

export default function Chalkboard() {
  return (
    <group>
      {/* Papan fisik — geometri L dari kamera awal: kamera (0,·,6.2)
          adalah sudutnya, karakter lurus di depan (0,0,0), papan di
          spoke kanan lalu dimundurkan jauh ke z≈0, diputar menghadap
          kamera (lihat BOARD_OPEN_* di CameraRig.tsx). */}
      <group position={[9.5, 0, 0]} rotation={[0, -0.45, 0]} scale={4.2}>
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
    </group>
  );
}
