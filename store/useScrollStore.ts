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
  setProgress: (progress: number) => void;
  setActiveSection: (section: SectionId) => void;
  setBoardOpen: (open: boolean) => void;
  setBoardInspect: (inspect: boolean) => void;
  setActiveProjectId: (id: string | null) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  activeSection: "hero",
  boardOpen: false,
  boardInspect: false,
  activeProjectId: null,
  setProgress: (progress) => set({ progress }),
  setActiveSection: (section) => set({ activeSection: section }),
  // Menutup board me-reset semua turunannya — inspeksi & quest window
  // tidak boleh selamat dari board yang sudah tertutup.
  setBoardOpen: (open) =>
    set({
      boardOpen: open,
      ...(open ? {} : { boardInspect: false, activeProjectId: null }),
    }),
  setBoardInspect: (inspect) => set({ boardInspect: inspect }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
}));
