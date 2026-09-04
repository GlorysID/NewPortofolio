"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useScrollStore } from "@/store/useScrollStore";
import { useBoardProjects } from "@/lib/useBoardProjects";
import { extractYouTubeId, isLocalVideo } from "@/lib/video";

const MdxBody = dynamic(() => import("./MdxBody"), { ssr: false });

/**
 * ProjectOverlay — jendela quest bergaya kertas. Urutan konten
 * (semua section kondisional): cover img, header title/year, summary,
 * video (YouTube embed atau video lokal, poster = cover), MDX body
 * opsional, tags, CTA, Tutup. Escape/Tutup/GSAP entrance tidak berubah.
 */

const mdxComponents = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      className="mt-4 font-display text-[16px] leading-tight text-[#20201f]"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3
      className="mt-4 font-display text-[14px] leading-tight text-[#20201f]"
      {...props}
    />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p
      className="mt-2 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul
      className="mt-2 list-disc space-y-1 pl-4 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol
      className="mt-2 list-decimal space-y-1 pl-4 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="text-[#6f5a39] underline decoration-[#e8a33d]/60 underline-offset-2"
      {...props}
    />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-[#20201f]" {...props} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="mt-2 border-l-2 border-[#e8a33d]/60 pl-3 font-body text-[13px] italic leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
};

export default function ProjectOverlay() {
  const activeProjectId = useScrollStore((s) => s.activeProjectId);
  const setActiveProjectId = useScrollStore((s) => s.setActiveProjectId);
  const panelRef = useRef<HTMLDivElement>(null);
  const { projects } = useBoardProjects();

  const project = projects.find((p) => p.id === activeProjectId);

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

  const coverUrl = project.cover;
  const videoId = project.video ? extractYouTubeId(project.video) : null;
  const localVideo = project.video ? isLocalVideo(project.video) : false;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Proyek: ${project.title}`}
      className="fixed right-6 top-1/2 z-[36] w-[360px] max-w-[calc(100vw-3rem)] -translate-y-1/2"
    >
      <div className="relative -rotate-[0.75deg] bg-[#f4efe4] p-6 pt-7 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] ring-1 ring-[#20201f]/15">
        <span
          aria-hidden
          className="absolute left-1/2 top-2.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#3a2f22] shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        />

        {coverUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="mb-4 w-full rounded-sm"
          />
        )}

        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#6f5a39]">
          Quest Board — {project.year}
        </p>
        <div className="mt-2.5 h-[7px] w-[120px] bg-[#e8a33d]" />
        <h3 className="mt-4 font-display text-[23px] leading-tight text-[#20201f]">
          {project.title}
        </h3>
        <p className="mt-2 font-body text-[13px] leading-[1.6] text-[#4c4c49]">
          {project.summary}
        </p>

        {videoId && (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-sm bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={`Video proyek ${project.title}`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        )}
        {!videoId && localVideo && (
          <video
            controls
            playsInline
            preload="metadata"
            poster={coverUrl}
            src={project.video}
            className="mt-3 aspect-video w-full rounded-sm bg-black"
          />
        )}
        {project.video && !videoId && !localVideo && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f5a39]">
            Video: {project.video}
          </p>
        )}

        {project.compiled && (
          <div className="mt-3 max-h-[46vh] overflow-y-auto border-t border-[#20201f]/12 pt-3 pr-1">
            <MdxBody {...project.compiled} components={mdxComponents} />
          </div>
        )}

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

        <div className="mt-5 flex items-center justify-between border-t border-[#20201f]/15 pt-4">
          <div className="flex flex-col gap-1.5">
            {project.link && (
              <a
                href={project.link}
                className="font-display text-[14px] text-[#20201f] underline decoration-[#20201f]/30 underline-offset-4 transition-colors hover:text-[#6f5a39]"
              >
                Buka Proyek ↗
              </a>
            )}
            {project.linkGithub && (
              <a
                href={project.linkGithub}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#20201f]/60 underline decoration-[#20201f]/20 underline-offset-4 transition-colors hover:text-[#6f5a39]"
              >
                GitHub ↗
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveProjectId(null)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#20201f]/45 transition-colors hover:text-[#20201f]"
          >
            Tutup
          </button>
        </div>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 border-4 border-[#20201f]/8"
        />
      </div>
    </div>
  );
}
