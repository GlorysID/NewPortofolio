import { create } from "zustand";

export type SectionId = "hero" | "about" | "skills" | "projects" | "contact";

interface ScrollState {
  /** Progress scroll keseluruhan halaman (0–1) */
  progress: number;
  /** Section aktif — progress terdekat ke salah satu dari 5 section */
  activeSection: SectionId;
  setProgress: (progress: number) => void;
  setActiveSection: (section: SectionId) => void;
}

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  activeSection: "hero",
  setProgress: (progress) => set({ progress }),
  setActiveSection: (section) => set({ activeSection: section }),
}));
