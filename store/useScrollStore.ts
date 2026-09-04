import { create } from "zustand";

export type SectionId = "hero" | "about" | "skills" | "projects" | "contact";

interface ScrollState {
  /** Progress scroll keseluruhan halaman (0–1) */
  progress: number;
  /** Section aktif — progress terdekat ke salah satu dari 5 section */
  activeSection: SectionId;
  /** Chalkboard project board terbuka (kamera menoleh ke kanan, hero) */
  boardOpen: boolean;
  /** Mode inspeksi papan: kamera dolly-in mendekat (hanya berlaku saat
      boardOpen + hero). true = kertas di papan bisa diklik. */
  boardInspect: boolean;
  /** Proyek aktif di jendela quest overlay (2D) — null = tertutup */
  activeProjectId: string | null;
  /** Semua aset (glb/tekstur) selesai dimuat & di-decode */
  assetsLoaded: boolean;
  /** Certificate Wall terbuka (kamera menoleh ke KIRI, hero) */
  certWallOpen: boolean;
  /** Mode inspeksi dinding sertifikat (certWallOpen + hero) */
  certInspect: boolean;
  /** Sertifikat aktif di overlay (2D) — null = tertutup */
  activeCertId: string | null;
  /** Scene benar-benar hangat: shader terkompilasi, bayangan di-bake,
      ≥8 frame sudah dirender setelah aset masuk — gerbang hanya BOLEH
      dibuka setelah flag ini true. Inilah sumber kebenaran gerbang. */
  sceneReady: boolean;
  setProgress: (progress: number) => void;
  setActiveSection: (section: SectionId) => void;
  setBoardOpen: (open: boolean) => void;
  setBoardInspect: (inspect: boolean) => void;
  setActiveProjectId: (id: string | null) => void;
  setCertWallOpen: (open: boolean) => void;
  setCertInspect: (inspect: boolean) => void;
  setActiveCertId: (id: string | null) => void;
  setAssetsLoaded: (loaded: boolean) => void;
  setSceneReady: (ready: boolean) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  activeSection: "hero",
  boardOpen: false,
  boardInspect: false,
  activeProjectId: null,
  certWallOpen: false,
  certInspect: false,
  activeCertId: null,
  assetsLoaded: false,
  sceneReady: false,
  setProgress: (progress) => set({ progress }),
  setActiveSection: (section) => set({ activeSection: section }),
  // Menutup board me-reset semua turunannya — inspeksi & quest window
  // tidak boleh selamat dari board yang sudah tertutup.
  setBoardOpen: (open) =>
    set({
      boardOpen: open,
      ...(open ? {} : { boardInspect: false, activeProjectId: null }),
    }),
  setBoardInspect: (inspect) =>
    set({
      boardInspect: inspect,
      // Keluar inspeksi (zoom-out) → quest window ikut tertutup
      // otomatis — jendela kertas tidak boleh selamat dari kamera
      // yang sudah mundur. (Membuka inspeksi tidak mengubahnya.)
      ...(inspect ? {} : { activeProjectId: null }),
    }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  // Mirror setBoardOpen — menutup dinding me-reset inspeksi + overlay.
  setCertWallOpen: (open) =>
    set({
      certWallOpen: open,
      ...(open ? {} : { certInspect: false, activeCertId: null }),
    }),
  // Keluar inspeksi dinding → overlay sertifikat ikut tertutup.
  setCertInspect: (inspect) =>
    set({
      certInspect: inspect,
      ...(inspect ? {} : { activeCertId: null }),
    }),
  setActiveCertId: (id) => set({ activeCertId: id }),
  setAssetsLoaded: (loaded) => set({ assetsLoaded: loaded }),
  setSceneReady: (ready) => set({ sceneReady: ready }),
}));
