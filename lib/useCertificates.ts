"use client";

import { useEffect, useState } from "react";

/**
 * useCertificates — sumber data dinding sertifikat (client). Fetch
 * /certificates-data sekali per sesi, cache module-scope (pola
 * useBoardProjects): satu request untuk semua konsumen.
 *
 * Data dibangun statis saat build dari content/certificates/*.mdx
 * (app/certificates-data/route.ts + lib/certificates.ts) — runtime
 * murni SSG.
 */

/** Kontrak data — diproduksi lib/certificates.ts (build time). */
export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  year: string;
  /** URL publik gambar (webp-preferred, /certificates-media/…) */
  image: string;
  /** Link verifikasi opsional (badge/credential) */
  link?: string;
}

/** Batas kertas sertifikat di dinding — sisanya diabaikan. */
export const MAX_CERTS = 12;

let cache: Certificate[] | null = null;
let pending: Promise<Certificate[]> | null = null;

async function load(): Promise<Certificate[]> {
  if (cache) return cache;
  if (!pending) {
    pending = fetch("/certificates-data")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        cache = Array.isArray(data) ? (data as Certificate[]) : [];
        return cache;
      })
      .catch(() => {
        pending = null;
        return [];
      });
  }
  return pending;
}

export function useCertificates(): {
  certificates: Certificate[];
  loading: boolean;
} {
  const [certificates, setCertificates] = useState<Certificate[]>(
    cache ?? [],
  );

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setCertificates(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { certificates, loading: certificates.length === 0 && cache === null };
}
