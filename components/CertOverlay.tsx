"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useScrollStore } from "@/store/useScrollStore";
import { useCertificates } from "@/lib/useCertificates";

/**
 * CertOverlay — jendela quest untuk SERTIFIKAT, gaya kertas sama
 * persis dengan ProjectOverlay (paper hangat, pin, mono coklat).
 * Fields: judul, issuer+year (mono), gambar sertifikat full-width,
 * link verifikasi CTA (opsional), Tutup. Mount via activeCertId;
 * Escape bertahap ditangani ScrollProgressController.
 */

export default function CertOverlay() {
  const activeCertId = useScrollStore((s) => s.activeCertId);
  const setActiveCertId = useScrollStore((s) => s.setActiveCertId);
  const panelRef = useRef<HTMLDivElement>(null);
  const { certificates } = useCertificates();

  const cert = certificates.find((c) => c.id === activeCertId);

  useEffect(() => {
    if (!cert || !panelRef.current) return;
    const panel = panelRef.current;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panel,
        { autoAlpha: 0, x: -24 },
        { autoAlpha: 1, x: 0, duration: 0.4, ease: "power3.out" },
      );
    });
    return () => {
      ctx.revert();
    };
  }, [cert]);

  if (!cert) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Sertifikat: ${cert.title}`}
      className="fixed left-6 top-1/2 z-[36] w-[360px] max-w-[calc(100vw-3rem)] -translate-y-1/2"
    >
      <div className="relative -rotate-[0.75deg] bg-[#f4efe4] p-6 pt-7 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] ring-1 ring-[#20201f]/15">
        {/* Pin — di atas-tengah, satu keluarga dengan quest window */}
        <span
          aria-hidden
          className="absolute left-1/2 top-2.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#3a2f22] shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
        />

        {/* Header — mono coklat */}
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#6f5a39]">
          Sertifikat — {cert.year}
        </p>
        <div className="mt-2.5 h-[7px] w-[120px] bg-[#e8a33d]" />
        <h3 className="mt-4 font-display text-[22px] leading-tight text-[#20201f]">
          {cert.title}
        </h3>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f5a39]">
          Diterbitkan {cert.issuer}
        </p>

        {/* Gambar sertifikat — full-width */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cert.image}
          alt={`Sertifikat ${cert.title}`}
          loading="lazy"
          className="mt-4 w-full rounded-sm border border-[#20201f]/12"
        />

        {/* Verifikasi + Tutup */}
        <div className="mt-5 flex items-center justify-between border-t border-[#20201f]/15 pt-4">
          {cert.link ? (
            <a
              href={cert.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[14px] text-[#20201f] underline decoration-[#e8a33d]/50 underline-offset-4 transition-colors hover:text-[#6f5a39]"
            >
              Verifikasi ↗
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setActiveCertId(null)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#20201f]/45 transition-colors hover:text-[#20201f]"
          >
            Tutup
          </button>
        </div>

        {/* Tepi kertas */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 border-4 border-[#20201f]/8"
        />
      </div>
    </div>
  );
}
