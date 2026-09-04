"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * ContactGlow — pool cahaya putih lembut di titik pijak avatar.
 *
 * Radial gradient putih semi-transparan (canvas texture) di floor
 * tepat di bawah avatar, additive blending sehingga MELAPISI shadow
 * yang sudah ada (bukan menggantikan) — avatar tampak berpijak di
 * titik cahaya, bukan hanya bayangan gelap.
 */
export default function ContactGlow() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.35, "rgba(255,255,255,0.24)");
    g.addColorStop(0.7, "rgba(255,255,255,0.07)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Dispose texture saat unmount (bebas leak; WebGL terus hidup sepanjang sesi)
  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.035, 0]}
      renderOrder={1}
    >
      <circleGeometry args={[1.25, 48]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </mesh>
  );
}
