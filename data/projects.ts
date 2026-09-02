/**
 * BOARD_PROJECTS — sumber tunggal proyek di papan quest (chalkboard).
 *
 * ⚡ EDIT FILE INI untuk memasang proyek sungguhan: isi `title`,
 * `blurb`, `year`, `tags`, dan `link`. Kertas di papan 3D
 * (Chalkboard.tsx) dan jendela quest overlay (ProjectOverlay.tsx)
 * keduanya membaca dari array ini — satu sumber, ikut otomatis.
 *
 * Urutan array = posisi kertas di papan (baris-major: kiri-atas,
 * kanan-atas, kiri-bawah, kanan-bawah).
 */
export interface BoardProject {
  id: string;
  title: string;
  blurb: string;
  year: string;
  tags: string[];
  link: string;
}

export const BOARD_PROJECTS: BoardProject[] = [
  {
    id: "data-atlas",
    title: "Interactive Data Atlas",
    blurb: "Visualisasi data geospasial real-time berbasis WebGL — ribuan titik, tetap mulus.",
    year: "2025",
    tags: ["WebGL", "Deck.gl", "React"],
    link: "#",
  },
  {
    id: "brand-studio",
    title: "Generative Brand Studio",
    blurb: "Tool generatif identitas visual untuk brand kecil — logo dari sistem, bukan kebetulan.",
    year: "2025",
    tags: ["Canvas", "Generative", "Node"],
    link: "#",
  },
  {
    id: "spatial-ui",
    title: "Spatial UI Prototype",
    blurb: "Eksperimen antarmuka spasial di WebXR — panel mengikuti ruang, bukan layar.",
    year: "2026",
    tags: ["WebXR", "Three.js", "UX"],
    link: "#",
  },
  {
    id: "portfolio-engine",
    title: "Portfolio Engine",
    blurb: "Situs ini: panggung 3D, kamera dokumenter, kartu cetak — dibangun dari nol.",
    year: "2026",
    tags: ["R3F", "GSAP", "Next.js"],
    link: "#",
  },
];
