import type { SectionId } from "@/store/useScrollStore";

/**
 * Definisi "shot" kamera per section — gaya kamera dokumenter.
 * Setiap shot: posisi kamera + titik fokus (lookAt) saat section aktif.
 *
 * Pemetaan progress → shot (dipakai CameraRig):
 *   progress 0.0 → hero | 0.25 → about | 0.5 → skills
 *   progress 0.75 → projects | 1.0 → contact
 *
 * Kartu konten kini overlay 2D (fixed di sisi layar) — posisi kartu
 * tidak lagi terikat titik 3D, lihat components/ContentCards.tsx.
 */
export interface CameraShot {
  id: SectionId;
  label: string;
  /** Posisi kamera [x, y, z] */
  position: [number, number, number];
  /** Titik fokus lookAt [x, y, z] */
  target: [number, number, number];
}

export const SHOTS: CameraShot[] = [
  {
    id: "hero",
    label: "Wide Shot",
    position: [0, 1.6, 6.2],
    target: [0, 1.3, 0],
  },
  {
    id: "about",
    label: "Close-up Kepala",
    position: [1.0, 2.1, 2.1],
    target: [0, 2.08, 0],
  },
  {
    id: "skills",
    label: "Detail Tangan",
    position: [1.5, 1.25, 1.6],
    target: [0.45, 1.1, 0],
  },
  {
    id: "projects",
    label: "3/4 Torso",
    position: [-2.1, 1.5, 2.2],
    target: [0, 1.25, 0],
  },
  {
    id: "contact",
    label: "Pull-back",
    position: [0, 2.4, 7.2],
    target: [0, 1.4, 0],
  },
  {
    id: "certificates",
    label: "Sertifikat",
    position: [0, 2.4, 7.2],
    target: [0, 1.4, 0],
  },
];

export const SHOT_BY_ID = Object.fromEntries(
  SHOTS.map((shot) => [shot.id, shot])
) as Record<SectionId, CameraShot>;
