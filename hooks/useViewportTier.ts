"use client";

import { useSyncExternalStore } from "react";

/**
 * useViewportTier — sumber kebenaran TUNGGAL untuk klasifikasi viewport
 * & input, dipakai lintas rig 3D + controller scroll.
 *
 * Media queries (konstanta MQ diekspos agar konsumen non-hook — mis.
 * ScrollProgressController — membaca mq yang SAMA):
 * - compact      : (max-width: 767px), (max-height: 479px)
 * - coarse       : (pointer: coarse)
 * - portrait     : (orientation: portrait)
 * - short        : (max-height: 479px)
 * - reducedMotion: (prefers-reduced-motion: reduce)
 *
 * Arsitektur:
 * - SATU set matchMedia + change listener di level modul (pola lama
 *   CameraRig:146-162, dinaikkan jadi store tunggal) — konsumen
 *   sebanyak apa pun tidak menambah listener baru.
 * - `state` diganti referensi HANYA saat ada nilai berubah → snapshot
 *   useSyncExternalStore stabil; re-render hanya saat benar-benar flip.
 * - SSR-safe: sampai module ter-evaluasi di client, state = nilai
 *   desktop (semua false) — perilaku desktop dipertahankan apa adanya.
 * - Self-sync atribut data-* di <html> untuk selector CSS:
 *     dataset.tier     = "compact" | "desktop"
 *     dataset.coarse   = "true" | (atribut dihapus)
 *     dataset.portrait = "true" | (atribut dihapus)
 * - Refs non-rerender (`tierRefs`, juga diekspos via return `.refs`):
 *   dibaca di dalam useFrame / handler event tanpa memicu render ulang.
 */

export type Tier = "compact" | "desktop";

/** Refs non-rerender — objek modul tunggal, selalu sinkron. */
export interface TierRefs {
  compact: { current: boolean };
  portrait: { current: boolean };
  coarse: { current: boolean };
  short: { current: boolean };
  reducedMotion: { current: boolean };
}

export interface ViewportTier {
  /** "compact" = (max-width:767px) ATAU (max-height:479px) */
  tier: Tier;
  /** (orientation: portrait) */
  portrait: boolean;
  /** (pointer: coarse) */
  coarse: boolean;
  /** (max-height: 479px) */
  short: boolean;
  /** (prefers-reduced-motion: reduce) */
  reducedMotion: boolean;
  /** Akses non-rerender untuk useFrame / event handlers. */
  refs: TierRefs;
}

export const MQ = {
  compact: "(max-width: 767px), (max-height: 479px)",
  coarse: "(pointer: coarse)",
  portrait: "(orientation: portrait)",
  short: "(max-height: 479px)",
} as const;

const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

interface TierState {
  compact: boolean;
  portrait: boolean;
  coarse: boolean;
  short: boolean;
  reducedMotion: boolean;
}

/** Default SSR/desktop — semua false (byte-identical sampai terbukti). */
const DESKTOP: TierState = {
  compact: false,
  portrait: false,
  coarse: false,
  short: false,
  reducedMotion: false,
};

/** Refs tunggal modul — juga diimpor langsung oleh kode module-scope
 *  (mis. sampleShot di CameraRig) yang tidak bisa memanggil hook. */
export const tierRefs: TierRefs = {
  compact: { current: false },
  portrait: { current: false },
  coarse: { current: false },
  short: { current: false },
  reducedMotion: { current: false },
};

function applyRefs(s: TierState): void {
  tierRefs.compact.current = s.compact;
  tierRefs.portrait.current = s.portrait;
  tierRefs.coarse.current = s.coarse;
  tierRefs.short.current = s.short;
  tierRefs.reducedMotion.current = s.reducedMotion;
}

const canListen =
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const mqCompact = canListen ? window.matchMedia(MQ.compact) : null;
const mqCoarse = canListen ? window.matchMedia(MQ.coarse) : null;
const mqPortrait = canListen ? window.matchMedia(MQ.portrait) : null;
const mqShort = canListen ? window.matchMedia(MQ.short) : null;
const mqReduced = canListen ? window.matchMedia(REDUCED_MQ) : null;

function readState(): TierState {
  return {
    compact: mqCompact?.matches ?? false,
    portrait: mqPortrait?.matches ?? false,
    coarse: mqCoarse?.matches ?? false,
    short: mqShort?.matches ?? false,
    reducedMotion: mqReduced?.matches ?? false,
  };
}

/** Sinkron atribut data-* di <html> — kontrak selector CSS. */
function syncDataset(s: TierState): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.tier = s.compact ? "compact" : "desktop";
  if (s.coarse) el.dataset.coarse = "true";
  else delete el.dataset.coarse;
  if (s.portrait) el.dataset.portrait = "true";
  else delete el.dataset.portrait;
}

// --- Store modul tunggal --------------------------------------------------
let state: TierState = DESKTOP;
const listeners = new Set<() => void>();

if (canListen) {
  state = readState();
  applyRefs(state);
  syncDataset(state);

  const onChange = () => {
    const next = readState();
    if (
      next.compact === state.compact &&
      next.portrait === state.portrait &&
      next.coarse === state.coarse &&
      next.short === state.short &&
      next.reducedMotion === state.reducedMotion
    ) {
      return;
    }
    state = next;
    applyRefs(next);
    syncDataset(next);
    listeners.forEach((emit) => emit());
  };

  for (const mq of [mqCompact, mqCoarse, mqPortrait, mqShort, mqReduced]) {
    mq?.addEventListener("change", onChange);
  }
}

function subscribe(emit: () => void): () => void {
  listeners.add(emit);
  return () => {
    listeners.delete(emit);
  };
}
const getSnapshot = (): TierState => state;
const getServerSnapshot = (): TierState => DESKTOP;

export function useViewportTier(): ViewportTier {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    tier: s.compact ? "compact" : "desktop",
    portrait: s.portrait,
    coarse: s.coarse,
    short: s.short,
    reducedMotion: s.reducedMotion,
    refs: tierRefs,
  };
}
