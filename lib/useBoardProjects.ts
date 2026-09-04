"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { MDXRemote } from "next-mdx-remote";

/**
 * useBoardProjects — sumber data kertas quest untuk SEMUA client
 * component (Chalkboard + ProjectOverlay). Fetch /projects-data sekali
 * per sesi, hasilnya di-cache module-scope: dua konsumen = SATU request.
 *
 * Data dibangun statis saat build dari content/projects/*.mdx (lihat
 * app/projects-data/route.ts + lib/projects.ts) — runtime murni SSG,
 * tanpa server. Body MDX (opsional) sudah dikompilasi saat build
 * (`compiled`) — client cukup <MDXRemote {...compiled} />.
 */

/** Kontrak data — diproduksi lib/projects.ts + route.ts (build time). */
export interface BoardProject {
  id: string;
  title: string;
  year: string;
  tags: string[];
  link: string;
  /** Opsional — link repo GitHub, CTA kedua di quest window */
  linkGithub?: string;
  summary: string;
  /** Opsional — filename cover (URL publik: /projects-media/<folder>/) */
  cover?: string;
  /** Opsional — URL YouTube ATAU filename video lokal (.mp4/.webm/.mov) */
  video?: string;
  /** MDX terkompilasi (build time) — siap di-spread ke MDXRemote.
      Ada hanya bila file .mdx punya body; body kini OPSIONAL. */
  compiled?: ComponentProps<typeof MDXRemote>;
}

/** Batas kertas di papan — sisanya diabaikan (urut filename). */
export const MAX_PAPERS = 12;

let cache: BoardProject[] | null = null;
let pending: Promise<BoardProject[]> | null = null;

async function load(): Promise<BoardProject[]> {
  if (cache) return cache;
  if (!pending) {
    pending = fetch("/projects-data")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        cache = Array.isArray(data) ? (data as BoardProject[]) : [];
        return cache;
      })
      .catch(() => {
        pending = null;
        return [];
      });
  }
  return pending;
}

export function useBoardProjects(): {
  projects: BoardProject[];
  loading: boolean;
} {
  const [projects, setProjects] = useState<BoardProject[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setProjects(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { projects, loading: projects.length === 0 && cache === null };
}
