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
const BOARD_HEIGHT = 2.8;
const BOARD_URL = "/models/chalkboard.glb";

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

export default function Chalkboard() {
  return (
    <group>
      {/* Papan — auto-fit tinggi 3.9 m; penempatan & rotasi hadap di
          sini. Kamera (0,·,6.2) sudutnya, karakter lurus di depan,
          papan di spoke kanan yang dimundurkan ke z=0. */}
      <group position={[12.8, 0, -0.8]} rotation={[0, -1.1, 0]}>
        <Suspense fallback={null}>
          <BoardModel />
        </Suspense>
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
