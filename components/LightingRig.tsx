"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * LightingRig — setup 3-titik sinematik + alur cahaya vertikal
 * "lampu sorot" (HARDCODE, revisi final).
 *
 * Nilai dikunci sesuai tuning yang sudah disetujui user — panel Leva
 * dihapus, tidak ada lagi kontrol runtime:
 *
 * Key  : [2.60, 3.20, 2.20], intensity 2.20, #ffffff — soft shadow
 *        avatar→floor JANGAN diubah (bentuk/softness dipertahankan).
 * Rim  : [-1.40, 2.60, -2.20], intensity 9.00, #e8a33d,
 *        angle 0.42, penumbra 0.60 — garis siluet dari belakang.
 * Fill : [-2.40, 1.40, 2.80], intensity 0.35, #b8c4e0 — redup.
 *
 * ——— Alur vertikal top→bottom (tambahan, satu cerita visual) ———
 * Beam  : spot studio dari atas [0, 6.6, 0.8] → (0,0,0), warm white
 *         #ffd9a6, tanpa castShadow (shadow tetap milik key directional
 *         — satu-satunya shadow caster di scene).
 * Cone  : kerucut gradient additive (fake volumetric) — mesh STATIS,
 *         nol per-frame JS, depthWrite off, renderOrder 2. Sumber
 *         sengaja di luar frame (y≈6.6): shaft masuk dari atas frame,
 *         bahasa teater yang sudah terbaca tanpa perlu fixture.
 * Pool  : lingkaran emas radius 1.9 di lantai — titik pendaran sorot,
 *         additive sehingga MENYATU (bukan menimpa) ContactGlow putih:
 *         inti putih, halo emas, satu kolam hangat.
 * Uplight: 2 titik hangat kecil di kaki panggung (kiri-depan &
 *         kanan-belakang, asimetris mengikuti rig) — gema hangat dari
 *         bawah yang "menyambut" sorot dari atas.
 *
 * Semua cahaya baru castShadow={false}. Tanpa postprocessing, tanpa
 * per-frame JS. Palet tunggal: keluarga warm white/gold.
 */

const LIGHTING = {
  key: {
    position: [2.6, 3.2, 2.2] as [number, number, number],
    intensity: 2.2,
    color: "#ffffff",
  },
  rim: {
    position: [-1.4, 2.6, -2.2] as [number, number, number],
    intensity: 9,
    color: "#e8a33d",
    angle: 0.42,
    penumbra: 0.6,
  },
  fill: {
    position: [-2.4, 1.4, 2.8] as [number, number, number],
    intensity: 0.35,
    color: "#b8c4e0",
  },
  // Lampu sorot atas — key vertikal hangat, mengarah ke (0,0,0)
  // (target default SpotLight = titik asal, tepat di kaki avatar).
  beam: {
    position: [0, 6.6, 0.8] as [number, number, number],
    intensity: 14,
    color: "#ffd9a6",
    angle: 0.27,
    penumbra: 0.55,
  },
  // Sorot CHALKBOARD — bahasa visual identik dengan beam karakter,
  // dipasang di kaki papan (13, 0, 0): satu panggung, satu cerita.
  // Apex digeser ke kiri (x 12.2) agar shaft masuk miring dari kiri-atas;
  // angle 0.42 + radius cone 2.1 = cakupan lebih lebar untuk papan.
  boardBeam: {
    position: [12.2, 6.6, 0.8] as [number, number, number],
    aim: [13, 0, 0] as [number, number, number],
    intensity: 14,
    color: "#ffd9a6",
    angle: 0.42,
    penumbra: 0.6,
  },
  // Kerucut sorot terlihat — inti lebih sempit dari cone cahaya asli
  // (angle 0.27 → radius penuh ~1.84 di dasar) supaya spill lembut
  // membukus batang inti yang terdefinisi. radiusBoard lebih lebar:
  // footprint sorot papan (angle 0.42) + satu keluarga dengan karakter.
  beamVisual: {
    height: 6.3, // apex di lampu, dasar mengambang ~0.2-0.5 di atas lantai
    radius: 1.35,
    radiusBoard: 2.1,
    opacity: 0.42,
  },
  // Kolam emas — footprint sorot di lantai (radius ≈ tan(0.27)×6.65).
  pool: {
    radius: 1.9,
  },
  // Uplight kaki panggung — asimetris, menggemakan sorot dari bawah.
  uplightA: {
    position: [-1.05, 0.25, 0.5] as [number, number, number],
    intensity: 1.2,
    color: "#f0a24d",
    distance: 5,
  },
  uplightB: {
    position: [1.0, 0.2, -0.45] as [number, number, number],
    intensity: 0.85,
    color: "#ffb15c",
    distance: 4,
  },
};

/** Tekstur gradien vertikal untuk kerucut sorot (dibuat 1x, statis).
 *  Canvas y=0 = apex kerucut (uv v=1, paling terang) → memudar ke dasar. */
function makeBeamTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,241,214,0.42)");
  g.addColorStop(0.3, "rgba(255,228,185,0.20)");
  g.addColorStop(0.65, "rgba(255,218,170,0.075)");
  g.addColorStop(1, "rgba(255,210,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Tekstur radial emas untuk kolam pendaran sorot (dibuat 1x, statis). */
function makePoolTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,196,120,0.38)");
  g.addColorStop(0.4, "rgba(255,180,100,0.16)");
  g.addColorStop(0.75, "rgba(255,170,90,0.05)");
  g.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** BeamCone — fake volumetric: kerucut open-ended additive, STATIS.
 *  Orientasi dihitung sekali dari posisi beam → origin (tanpa per-frame
 *  JS). depthWrite off + additive = bebas masalah sorting transparansi;
 *  depth test tetap aktif sehingga avatar meng-occlude sisi belakang
 *  kerucut dengan benar. */
function BeamCone({
  apex: apexProp,
  aim,
  radius,
}: {
  apex: [number, number, number];
  aim: [number, number, number];
  radius: number;
}) {
  const texture = useMemo(() => makeBeamTexture(), []);

  const { position, quaternion } = useMemo(() => {
    const apex = new THREE.Vector3(...apexProp);
    const down = new THREE.Vector3(...aim).sub(apex).normalize();
    const up = down.clone().negate();
    // ConeGeometry: apex di +Y, dasar di -Y → selaraskan +Y dengan
    // arah dasar→apex (acuan: titik aim sorot).
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      up
    );
    const pos = apex.clone().addScaledVector(down, LIGHTING.beamVisual.height / 2);
    return { position: pos, quaternion: quat };
  }, [apexProp, aim, radius]);

  // Dispose texture saat unmount (pola sama dengan ContactGlow)
  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh position={position} quaternion={quaternion} renderOrder={2}>
      <coneGeometry
        args={[radius, LIGHTING.beamVisual.height, 32, 1, true]}
      />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={LIGHTING.beamVisual.opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        fog={false}
      />
    </mesh>
  );
}

/** BeamFloorPool — kolam emas di lantai, titik pendaran sorot.
 *  Additive & di bawah ContactGlow (y 0.002 vs 0.004): inti putih
 *  ContactGlow tetap dominan, halo emas menyambungkan batang cahaya
 *  dari atas ke lantai. */
function BeamFloorPool({
  position,
}: {
  position: [number, number, number];
}) {
  const texture = useMemo(() => makePoolTexture(), []);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      renderOrder={1}
    >
      <circleGeometry args={[LIGHTING.pool.radius, 48]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </mesh>
  );
}

export default function LightingRig() {
  const rimRef = useRef<THREE.SpotLight>(null);
  const rimTarget = useRef(new THREE.Object3D());
  const boardRef = useRef<THREE.SpotLight>(null);
  const boardTarget = useRef(new THREE.Object3D());
  const scene = useThree((s) => s.scene);

  // Registrasi target spotlight rim & board beam ke scene
  useEffect(() => {
    const target = rimTarget.current;
    const bTarget = boardTarget.current;
    // Target sorot chalkboard = kaki papan (13, 0, 0)
    bTarget.position.set(
      LIGHTING.boardBeam.aim[0],
      LIGHTING.boardBeam.aim[1],
      LIGHTING.boardBeam.aim[2]
    );
    if (scene) {
      if (!target.parent) {
        scene.add(target);
        if (rimRef.current) rimRef.current.target = target;
      }
      if (!bTarget.parent) {
        scene.add(bTarget);
        if (boardRef.current) boardRef.current.target = bTarget;
      }
    }
    return () => {
      if (target.parent) scene.remove(target);
      if (bTarget.parent) scene.remove(bTarget);
    };
  }, [scene]);

  return (
    <>
      {/* KEY — depan-samping kanan, putih netral, soft shadow.
          Shadow camera diperluas (x ±14.5) agar mencakup chalkboard di
          x=13 — bayangan papan jatuh sungguhan, satu-satunya caster. */}
      <directionalLight
        position={LIGHTING.key.position}
        intensity={LIGHTING.key.intensity}
        color={LIGHTING.key.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-camera-left={-3}
        shadow-camera-right={14.5}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* RIM — belakang kiri, accent amber, spread sempit */}
      <spotLight
        ref={rimRef}
        position={LIGHTING.rim.position}
        angle={LIGHTING.rim.angle}
        penumbra={LIGHTING.rim.penumbra}
        distance={9}
        decay={1.6}
        intensity={LIGHTING.rim.intensity}
        color={LIGHTING.rim.color}
      />

      {/* FILL — sisi kiri-depan, netral-dingin, sangat redup */}
      <directionalLight
        position={LIGHTING.fill.position}
        intensity={LIGHTING.fill.intensity}
        color={LIGHTING.fill.color}
      />

      {/* SOROT ATAS — key vertikal hangat dari y≈6.6 ke kaki avatar.
          Tanpa shadow (satu-satunya shadow caster tetap key di atas).
          Target default SpotLight = (0,0,0) — tepat di pijakan avatar,
          tanpa objek target tambahan. */}
      <spotLight
        position={LIGHTING.beam.position}
        angle={LIGHTING.beam.angle}
        penumbra={LIGHTING.beam.penumbra}
        decay={1.6}
        intensity={LIGHTING.beam.intensity}
        color={LIGHTING.beam.color}
        castShadow={false}
      />

      {/* Batang sorot terlihat (fake volumetric) + kolam pendarannya */}
      <BeamCone
        apex={LIGHTING.beam.position}
        aim={[0, 0, 0]}
        radius={LIGHTING.beamVisual.radius}
      />
      <BeamFloorPool position={[0, 0.002, 0]} />

      {/* SOROT CHALKBOARD — lampu + kerucut + kolam, bahasa visual
          identik dengan sorot karakter, dipasang di kaki papan
          (satu panggung, satu cerita cahaya). */}
      <spotLight
        ref={boardRef}
        position={LIGHTING.boardBeam.position}
        angle={LIGHTING.boardBeam.angle}
        penumbra={LIGHTING.boardBeam.penumbra}
        distance={9}
        decay={1.6}
        intensity={LIGHTING.boardBeam.intensity}
        color={LIGHTING.boardBeam.color}
        castShadow={false}
      />
      <BeamCone
        apex={LIGHTING.boardBeam.position}
        aim={LIGHTING.boardBeam.aim}
        radius={LIGHTING.beamVisual.radiusBoard}
      />
      <BeamFloorPool
        position={[LIGHTING.boardBeam.aim[0], 0.002, LIGHTING.boardBeam.aim[2]]}
      />

      {/* UPLIGHT KAKI PANGGUNG — dua titik hangat asimetris, menggemakan
          sorot dari bawah; tanpa shadow, jarak terbatas (hemat fill-rate). */}
      <pointLight
        position={LIGHTING.uplightA.position}
        intensity={LIGHTING.uplightA.intensity}
        color={LIGHTING.uplightA.color}
        distance={LIGHTING.uplightA.distance}
        decay={2}
        castShadow={false}
      />
      <pointLight
        position={LIGHTING.uplightB.position}
        intensity={LIGHTING.uplightB.intensity}
        color={LIGHTING.uplightB.color}
        distance={LIGHTING.uplightB.distance}
        decay={2}
        castShadow={false}
      />
    </>
  );
}
