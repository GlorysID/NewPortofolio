"use client";

import { useCertificates } from "@/lib/useCertificates";

/**
 * Certificates : section sertifikat non-3D di bawah Contact, satu
 * bahasa visual dengan photoshoot kit: contact sheet of credentials.
 *
 * - Header PaperHead-style (code "Certificates" + "FR 05"), display
 *   title Avermont, micro-label "Credentials · Roll 03".
 * - Tiap sertifikat = photo print: paper → white frame (border foto +
 *   strip bawah tebal ala cetakan klasik) → gambar → caption strip
 *   (title ink + issuer · year mono coklat).
 * - Tilts alternating deterministik (kelas statis : kompatibel dengan
 *   hover translate); hover lift + shadow grow, transisi restrained.
 * - Footer ArtifactFoot "Roll 03 · Credentials · N Frames" (dinamis).
 * - Kosong (0 sertifikat): satu frame cetakan kosong + mono label.
 * - Nol biaya GPU: murni DOM, gambar lazy.
 *
 * Wrapper section pointer-events-none (aturan page.tsx) : container
 * konten mengaktifkan pointer-events-auto; link verifikasi otomatis
 * ikut aktif.
 */

/** Tilts alternating (deg) : kelas statis per index, deterministik. */
const PRINT_TILT_CLASSES = [
  "-rotate-[0.8deg]",
  "rotate-[0.6deg]",
  "rotate-[1deg]",
  "-rotate-[0.7deg]",
  "rotate-[0.9deg]",
  "-rotate-[1deg]",
];

export default function Certificates() {
  const { certificates, loading } = useCertificates();

  return (
    <section
      id="certificates"
      className="relative flex min-h-screen w-full items-center justify-center px-6 sm:px-12"
    >
      <div className="pointer-events-auto w-full max-w-5xl">
        {/* Sprocket strip : pengikat bahasa film, aria-hidden, restrained */}
        <div
          aria-hidden
          className="mb-3 flex items-center justify-between opacity-40"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="block h-[6px] w-[10px] border border-[#20201f]/25"
            />
          ))}
        </div>

        {/* Header : PaperHead-style + display title + micro-label */}
        <div className="flex items-baseline justify-between border-b border-[#20201f]/12 pb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f5a39]">
            Certificates
          </span>
          <span className="font-mono text-[9px] tracking-[0.16em] text-[#777773]">
            FR 05
          </span>
        </div>
        <h2 className="mt-6 font-display text-4xl leading-[0.95] text-text sm:text-5xl">
          Sertifikat
        </h2>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#777773]">
          Credentials · Roll 03
        </p>

        {/* Grid photo prints — SCROLL INTERNAL (area lebih tinggi dari
            viewport; gesture system menyerap swipe vertikal, jadi area
            ini diberi scroll native sendiri via data-native-scroll).
            Kosong: satu frame cetakan kosong */}
        <div
          data-native-scroll
          className="mt-12 max-h-[calc(100dvh-17rem)] overflow-y-auto grid grid-cols-1 gap-x-10 gap-y-14 pr-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {!loading && certificates.length === 0 ? (
            <article className="-rotate-[0.8deg] bg-[#fffefa] p-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)] ring-1 ring-[#20201f]/15">
              <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-[#20201f]/20">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#a4a49f]">
                  Belum ada sertifikat
                </p>
              </div>
              <div className="pt-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#6f5a39]">
                  Roll 03 · Kosong
                </p>
              </div>
            </article>
          ) : (
            certificates.map((cert, i) => (
              <article
                key={cert.id}
                className={`${PRINT_TILT_CLASSES[i % PRINT_TILT_CLASSES.length]} bg-[#fffefa] p-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)] ring-1 ring-[#20201f]/15 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-16px_rgba(0,0,0,0.9)]`}
              >
                {/* White photo frame + strip bawah tebal (chrome About) */}
                <div className="relative bg-white p-3 pb-16 ring-1 ring-[#20201f]/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cert.image}
                    alt={`Sertifikat ${cert.title}`}
                    loading="lazy"
                    className="w-full border border-[#20201f]/10"
                  />
                  {/* Caption strip : di area putih tebal bawah */}
                  <div className="absolute inset-x-3 bottom-3">
                  <h3 className="truncate font-body text-[14px] font-semibold leading-snug text-[#20201f]">
                    {cert.title}
                  </h3>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-[#6f5a39]">
                    {cert.year}
                  </p>
                  </div>
                </div>
                {/* Verifikasi link : di bawah frame, gaya micro-label */}
                {cert.link && (
                  <div className="px-1 pt-3">
                    <a
                      href={cert.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6f5a39] underline decoration-[#6f5a39]/40 underline-offset-4 transition-colors hover:text-[#20201f]"
                    >
                      Lihat Kredensial ↗
                    </a>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Footer : ArtifactFoot dinamis */}
        <p className="mt-14 text-center font-mono text-[8px] uppercase tracking-[0.28em] text-[#777773]">
          Roll 03 · Credentials · {certificates.length} Frames
        </p>
      </div>
    </section>
  );
}
