/**
 * detectDevice.ts — Deteksi kapabilitas perangkat untuk alokasi resource adaptif.
 * 
 * Mendeteksi perangkat berspesifikasi rendah (HP entry-level maupun laptop dengan iGPU lemah/CPU <= 4 core)
 * tanpa mengganggu perangkat bertenaga tinggi (PC gaming, MacBook, flagship phone).
 */

let cachedLowEnd: boolean | null = null;

export function isLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (cachedLowEnd !== null) return cachedLowEnd;

  // 1. Data Saver mode aktif
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) {
    cachedLowEnd = true;
    return true;
  }

  // 2. Hardware Concurrency: CPU cores <= 4 (khas HP budget & laptop i3/celeron/dual-core lama)
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
    cachedLowEnd = true;
    return true;
  }

  // 3. Device Memory: RAM <= 4 GB
  const nav = navigator as unknown as { deviceMemory?: number };
  if (nav.deviceMemory && nav.deviceMemory <= 4) {
    cachedLowEnd = true;
    return true;
  }

  // 4. Deteksi renderer GPU via WebGL
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && "getExtension" in gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext)
          .getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          ?.toLowerCase() || "";
        
        // Mobile iGPU entry: Mali series, PowerVR, Adreno seri 3xx/4xx/5xx/610/612/616/620
        if (
          /mali|powervr|adreno \(tm\) [345]|adreno \(tm\) 61[026]|adreno \(tm\) 620/.test(
            renderer
          )
        ) {
          cachedLowEnd = true;
          return true;
        }

        // Laptop iGPU lemah / software fallback: Intel HD / UHD / Iris / Graphics, Mesa, LLVMpipe, SwiftShader, Vega 3/6
        if (
          /intel.*(hd|uhd|iris|graphics)|intel\(r\)|mesa|llvmpipe|swiftshader|microsoft basic render|vega [36]|radeon.*vega|radeon.*graphics|geforce gt|geforce 9[1-4]0m/.test(
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
