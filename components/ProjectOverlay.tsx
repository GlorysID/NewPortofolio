"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { BOARD_PROJECTS } from "@/data/projects";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * ProjectOverlay — jendela quest BERGAYA KERTAS (bukan panel gelap):
 * selebaran kertas hangat yang dipin di atas panggung — satu keluarga
 * dengan kertas-kertas di chalkboard (#f4efe4, tinta #20201f, aksen
 * #e8a33d, label mono coklat #6f5a39). Sedikit miring seperti kertas
 * quest sungguhan, pin di atas, bayangan dalam.
 *
 * - Mount/unmount via activeProjectId (store). GSAP entrance: fade +
 *   slide x dari +24px, 0.4s power3.out. Escape/Tutup → null.
 * - Kamera tetap di pose inspeksi; jendela ini yang menampilkan detail.
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
      {/* Kertas quest — hangat, miring -0.75°, pin di atas-tengah */}
      <div className="relative -rotate-[0.75deg] bg-[#f4efe4] p-6 pt-7 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] ring-1 ring-[#20201f]/15">
        {/* Pin — bulatan gelap di atas-tengah, seperti kertas tersemat */}
        <span
          aria-hidden
          className="absolute left-1/2 top-2.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#3a2f22] shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        />

        {/* Header quest — mono coklat, aksen garis */}
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#6f5a39]">
          Quest Board — {project.year}
        </p>
        <div className="mt-2.5 h-[7px] w-[120px] bg-[#e8a33d]" />
        <h3 className="mt-4 font-display text-[23px] leading-tight text-[#20201f]">
          {project.title}
        </h3>
        <p className="mt-2 font-body text-[13px] leading-[1.6] text-[#4c4c49]">
          {project.blurb}
        </p>

        {/* Tag chips — mono hairline coklat */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="border border-[#6f5a39]/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f5a39]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA + Tutup */}
        <div className="mt-5 flex items-center justify-between border-t border-[#20201f]/15 pt-4">
          <a
            href={project.link}
            className="font-display text-[14px] text-[#20201f] underline decoration-[#20201f]/30 underline-offset-4 transition-colors hover:text-[#6f5a39]"
          >
            Buka Proyek ↗
          </a>
          <button
            type="button"
            onClick={() => setActiveProjectId(null)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#20201f]/45 transition-colors hover:text-[#20201f]"
          >
            Tutup
          </button>
        </div>

        {/* Tepi kertas — garis gelap tipis (kertas dipotong) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 border-4 border-[#20201f]/8"
        />
      </div>
    </div>
  );
}
