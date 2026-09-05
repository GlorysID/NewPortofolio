"use client";

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Avatar — model .glb asli (scan fotogrammetri).
 *
 * Placeholder capsule fase 1 sudah DIHAPUS (permintaan user) —
 * komponen ini murni memuat public/models/avatar.glb.
 * Jika file gagal load, error boundary merender null (tidak crash,
 * tidak kembali ke placeholder).
 */

const GLB_URL = "/models/avatar.glb";

/**
 * FRAMING MANUAL — ubah nilai ini kalau proporsi model asli beda.
 * - height   : tinggi model di scene; skala otomatis dihitung agar
 *              tinggi bounding box model = nilai ini (scan asli ~1.16).
 * - offset*  : geser manual setelah auto-fit (bottom model di y=0).
 * - rotationY: hadapkan model ke arah kamera (wajah scan menghadap +Z).
 */
export const MODEL_FIT = {
  height: 2.3,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotationY: 0,
};

// Error boundary: load gagal → render null (tidak crash)
class ModelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function GLTFModel() {
  // Argumen kedua `true` = Draco aktif (decoder CDN default drei)
  const { scene, animations } = useGLTF(GLB_URL, true);
  const group = useRef<THREE.Group>(null);

  // Auto-fit: skala ke MODEL_FIT.height, bottom ke lantai (y=0),
  // lalu offset/rotasi manual — framing konsisten dengan data/shots.ts.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;

    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = MODEL_FIT.height / (size.y || 1);
    g.scale.setScalar(scale);

    const fitted = new THREE.Box3().setFromObject(g);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    g.position.x += MODEL_FIT.offsetX - center.x;
    g.position.y += MODEL_FIT.offsetY - fitted.min.y;
    g.position.z += MODEL_FIT.offsetZ - center.z;
    g.rotation.y = MODEL_FIT.rotationY;
  }, []);

  // Animation clip (kalau model kelak punya): idle/breath/stand → loop
  const { actions, names } = useAnimations(animations, group);

  // Aktifkan shadow casting — key light butuh avatar casting ke floor
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        // Skip dari raycast: avatar 513rb vertex tidak butuh hover —
        // klik papan lewat BoardClickProxy. R3F men-tes SEMUA mesh pada
        // SETIAP pointermove (ratusan event/detik) — tanpa skip ini,
        // raycast 500rb+ triangle = CPU spike = FPS drop saat drag.
        mesh.raycast = () => null;
      }
    });
  }, [scene]);
  useEffect(() => {
    const preferred =
      names.find((n) => /idle|breath|stand/i.test(n)) ?? names[0];
    const action = preferred ? actions[preferred] : undefined;
    if (action) {
      action.reset().setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }
  }, [actions, names]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

interface AvatarProps {
  position?: [number, number, number];
}

export default function Avatar({ position = [0, 0, 0] }: AvatarProps) {
  return (
    <group position={position}>
      <ModelBoundary>
        <Suspense fallback={null}>
          <GLTFModel />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}
