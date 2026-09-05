"use client";

import { useCertificates } from "@/lib/useCertificates";
import { useScrollStore } from "@/store/useScrollStore";

/**
 * Certificates — section sertifikat non-3D di bawah Contact.
 *
 * Konten dari content/certificates/*.mdx (pipeline yang sama dengan
 * project: loader + certificates-data statis + hook). Grid responsif
 * kartu kertas (1 kolom mobile, 2 desktop) — foto + metadata + CTA
 * verifikasi. Nol biaya GPU: murni DOM, gambar lazy.
 */
export default function Certificates() {
  const { certificates, loading } = useCertificates();
  const boardOpen = useScrollStore((s) => s.boardOpen);

  return (
    <section
      id="certificates"
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 sm:px-12"
    >
      <div
        className={`pointer-events-auto w-full max-w-4xl transition-opacity duration-500 ${
          boardOpen ? "opacity-0" : "opacity-100"
        }`}
      >
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.45em] text-accent">
          Sertifikat
        </p>
        <h2 className="font-display text-4xl leading-[0.95] text-text sm:text-5xl">
          Kredensial &amp; Penghargaan
        </h2>

        {!loading && certificates.length === 0 ? (
          <p className="mt-8 font-body text-sm text-muted">
            Sertifikat akan segera ditambahkan.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {certificates.map((cert) => (
              <article
                key={cert.id}
                className="-rotate-[0.4deg] bg-[#f4efe4] p-4 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)] ring-1 ring-[#20201f]/15"
              >
                {cert.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cert.image}
                    alt={`Sertifikat ${cert.title}`}
                    loading="lazy"
                    className="w-full rounded-[2px] border border-[#20201f]/10"
                  />
                )}
                <div className="mt-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#6f5a39]">
                    {cert.issuer} · {cert.year}
                  </p>
                  <h3 className="mt-1.5 font-body text-[15px] font-semibold leading-snug text-[#20201f]">
                    {cert.title}
                  </h3>
                  {cert.link && (
                    <a
                      href={cert.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-[#6f5a39] underline decoration-[#6f5a39]/40 underline-offset-4 transition-colors hover:text-[#20201f]"
                    >
                      Lihat Kredensial ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
