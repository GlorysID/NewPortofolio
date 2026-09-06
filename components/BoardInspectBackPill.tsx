"use client";

import { useScrollStore } from "@/store/useScrollStore";

/**
 * BoardInspectBackPill — tombol floating "← KEMBALI KE PAPAN"
 * Tampil saat kamera sedang zoom-in / inspeksi chalkboard dan tidak ada
 * project overlay yang sedang terbuka. Memudahkan pengguna di mobile/tablet
 * (maupun desktop) untuk keluar dari zoom tanpa risiko salah gesture.
 */
export default function BoardInspectBackPill() {
  const boardOpen = useScrollStore((s) => s.boardOpen);
  const boardInspect = useScrollStore((s) => s.boardInspect);
  const activeProjectId = useScrollStore((s) => s.activeProjectId);

  if (!boardOpen || !boardInspect || activeProjectId) return null;

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none animate-fade-in">
      <button
        type="button"
        onClick={() => useScrollStore.getState().setBoardInspect(false)}
        className="flex items-center gap-2 rounded-full border border-white/25 bg-black/80 px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur-md transition-all active:scale-95 hover:bg-black hover:border-white/50 hover:text-amber-300"
      >
        <span className="text-amber-400 font-bold">←</span>
        <span>Kembali ke Papan</span>
      </button>
    </div>
  );
}
