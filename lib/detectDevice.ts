/**
 * detectDevice.ts — Deteksi kapabilitas perangkat untuk alokasi resource adaptif.
 * 
 * Mendeteksi perangkat berspesifikasi rendah (entry-level mobile) tanpa
 * mengganggu perangkat desktop atau flagship mobile (iPhone, Snapdragon 8, dsb.).
 */

let cachedLowEnd: boolean | null = null;

export function isLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (cachedLowEnd !== null) return cachedLowEnd;

  // Hanya periksa pada perangkat sentuh/mobile
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  if (!isCoarse) {
    cachedLowEnd = false;
    return false;
  }

  // 1. Hardware Concurrency: CPU cores <= 4 (ciri khas HP budget/entry)
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    cachedLowEnd = true;
    return true;
  }

  // 2. Device Memory: RAM <= 4 GB
  const nav = navigator as unknown as { deviceMemory?: number };
  if (nav.deviceMemory && nav.deviceMemory <= 4) {
    cachedLowEnd = true;
    return true;
  }

  // 3. Deteksi renderer GPU via WebGL (Mali entry / PowerVR / Adreno seri 5xx/610)
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && "getExtension" in gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext)
          .getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          ?.toLowerCase() || "";
        // GPU entry-level yang sering mengalami bottleneck fill-rate
        if (
          /mali-g5[12]|mali-g31|mali-t|powervr|adreno \(tm\) 5|adreno \(tm\) 610|adreno \(tm\) 612|adreno \(tm\) 616/.test(
            renderer
          )
        ) {
          cachedLowEnd = true;
          return true;
        }
      }
    }
  } catch {
    // Abaikan jika browser memblokir WebGL debug extension
  }

  cachedLowEnd = false;
  return false;
}
