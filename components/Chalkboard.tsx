"use client";

import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Chalkboard — papan proyek 3D, jauh di sisi kanan panggung.
 *
 * Perlakuan render SAMA dengan Avatar (Avatar.tsx):
 * - Auto-fit: skala dihitung dari bounding box (tinggi target 3.9 m,
 *   bottom di y=0) — bukan angka scale manual.
 * - castShadow=true per mesh → key directional light memunculkan
 *   bayangan sungguhan; tekstur/material asli glb tidak diopresi.
 * - Loading `useGLTF` polos (geometri bukan draco; ekstensi hanya
 *   EXT_texture_webp — native three.js), Suspense agar enter gate
 *   (drei useProgress) menunggu model ini.
 * - Cahaya: beam studio + kerucut + kolam di LightingRig.tsx
 *   (shadow camera key light diperluas mencakup papan).
 * - Statis: nol pekerjaan per-frame.
 */

/** Tinggi papan di scene (meter) — acuan auto-fit (pola Avatar.tsx). */
const BOARD_HEIGHT = 3.9;
const BOARD_URL = "/models/chalkboard.glb";

function BoardModel() {
  const { scene } = useGLTF(BOARD_URL);
  const group = useRef<THREE.Group>(null);

  // Auto-fit: skala ke BOARD_HEIGHT, bottom ke lantai (y=0), center x/z.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = BOARD_HEIGHT / (size.y || 1);
    g.scale.setScalar(scale);
    const fitted = new THREE.Box3().setFromObject(g);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    g.position.x -= center.x;
    g.position.y -= fitted.min.y;
    g.position.z -= center.z;
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

export default function Chalkboard() {
  return (
    <group>
      {/* Papan — auto-fit tinggi 3.9 m; penempatan & rotasi hadap di
          sini. Kamera (0,·,6.2) sudutnya, karakter lurus di depan,
          papan di spoke kanan yang dimundurkan ke z=0. */}
      <group position={[13, 0, 0]} rotation={[0, -1.1, 0]}>
        <Suspense fallback={null}>
          <BoardModel />
        </Suspense>
      </group>
      {/* Aksen hangat wajah papan — world space, arah kamera board-open
          (castShadow false — hard rule: tanpa shadow caster tambahan) */}
      <pointLight
        position={[11.4, 2.4, 2.6]}
        intensity={12}
        decay={2}
        distance={9}
        color="#ffd9a6"
        castShadow={false}
      />
    </group>
  );
}
