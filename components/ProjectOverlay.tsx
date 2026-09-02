"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { BOARD_PROJECTS } from "@/data/projects";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * ProjectOverlay — jendela quest (quest window) bergaya MMORPG untuk
 * proyek aktif dari papan 3D. Murni DOM (di luar Canvas) — kamera
 * tetap di pose inspeksi; jendela ini yang menampilkan detail.
 *
 * - Mount/unmount via activeProjectId (store). GSAP entrance: fade +
 *   slide x dari +24px, 0.4s power3.out. Exit sederhana = unmount
 *   (quest window tutupnya tegas, tanpa animasi keluar).
 * - Tutup: tombol "Tutup" atau Escape → setActiveProjectId(null).
 *   Kamera tetap di inspeksi — menutup quest = kembali memandang papan.
 * - Panel: parchment-dark, hairline accent, aksen sudut, backdrop blur.
 *   Di atas kilatan kamera (z-[35]), di bawah enter gate (z-40).
 */

export default function ProjectOverlay() {
  const activeProjectId = useScrollStore((s) => s.activeProjectId);
  const setActiveProjectId = useScrollStore((s) => s.setActiveProjectId);
  const panelRef = useRef<HTMLDivElement>(null);

  const project = BOARD_PROJECTS.find((p) => p.id === activeProjectId);

  // Entrance + Escape — berjalan saat panel ada di DOM
  useEffect(() => {
    if (!project || !panelRef.current) return;
    const panel = panelRef.current;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, x: 24 },
        { autoAlpha: 1, x: 0, duration: 0.4, ease: "power3.out" },
      );
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveProjectId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      ctx.revert();
    };
  }, [project, setActiveProjectId]);

  if (!project) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Proyek: ${project.title}`}
      className="fixed right-6 top-1/2 z-[36] w-[360px] max-w-[calc(100vw-3rem)] -translate-y-1/2"
    >
      <div className="relative bg-[#141815]/95 p-6 backdrop-blur-sm ring-1 ring-[#e8a33d]/25">
        {/* Aksen sudut — bingkai quest window sederhana */}
        <span
          aria-hidden
          className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-[#e8a33d]/60"
        />
        <span
          aria-hidden
          className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-[#e8a33d]/60"
        />
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#e8a33d]/60"
        />
        <span
          aria-hidden
          className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#e8a33d]/60"
        />

        {/* Header quest */}
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#e8a33d]/80">
          Quest Board — {project.year}
        </p>
        <h3 className="mt-3 font-display text-[22px] leading-tight text-[#f4efe4]">
          {project.title}
        </h3>
        <p className="mt-2 font-body text-[13px] leading-[1.6] text-[#b9b6ad]">
          {project.blurb}
        </p>

        {/* Tag chips — mono hairline */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="border border-[#e8a33d]/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#e8a33d]/75"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA + Tutup */}
        <div className="mt-5 flex items-center justify-between border-t border-[#e8a33d]/20 pt-4">
          <a
            href={project.link}
            className="font-display text-[14px] text-[#f4efe4] underline decoration-[#e8a33d]/40 underline-offset-4 transition-colors hover:text-[#e8a33d]"
          >
            Buka Proyek ↗
          </a>
          <button
            type="button"
            onClick={() => setActiveProjectId(null)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white/90"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
