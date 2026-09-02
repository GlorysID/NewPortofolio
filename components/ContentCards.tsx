"use client";

/**
 * Konten kartu — satu "photoshoot kit": empat artefak cetak berbeda,
 * satu keluarga palet (kertas warm-white #fffefa, tinta #20201f,
 * hairline /10–12) dan satu perlakuan tipografi label (mono 8–9px,
 * uppercase, tracking lebar).
 *
 * - About    → "print": bingkai foto klasik (chrome di ContentCard)
 * - Skills   → "sheet": contact sheet — grid frame film bernomor
 * - Projects → "strip": shot list dengan strip sprocket hairline
 * - Contact  → "card": kartu nama studio (chrome "card" di ContentCard)
 *
 * Sisi belakang cetakan (CARD BACKS): kertas belakang foto cetak —
 * hampir kosong (ker tuaan kertas justru realistis), satu-dua stempel
 * tinta emas hangat (blok bingkai-ganda / cincin, rotasi tetap per
 * kartu — deterministik, SSR-safe), satu catatan "tangan" (italic body
 * sedikit miring, tanpa font baru) + tanggal coret, dan micro-label
 * kaki senada ArtifactFoot. Back face terlihat selama luncuran
 * (back-facing) sebelum kartu berbalik ke depan — flip di ContentCard.
 *
 * Budget vertikal: semua kartu dirancang ≤ ~530px tinggi (fotos 4/3,
 * sel ringkas, spacing rapat) supaya muat penuh di viewport pendek
 * (640–768px) — kartu fixed tidak bisa di-scroll, jadi konten
 * dikomposisi agar tidak pernah meluap.
 *
 * CameraFlash + suara shutter tetap dipasang di sini; animasi luncur
 * dari tengah viewport tidak berubah (ContentCard).
 */
import type { ReactNode } from "react";
import Image from "next/image";
import ContentCard, { type CardTitle } from "./ContentCard";
import CameraFlash from "./CameraFlash";

/* ------------------------------------------------------------------ */
/* Judul display per kartu — hand-tuned, deterministic (SSR-safe)      */
/* ------------------------------------------------------------------ */

/** Empat sudut berbeda + overhang vertikal bervariasi; x menggeser
    horizontal agar tidak seragam. Tidak ada Math.random. */
const CARD_TITLES: Record<
  "about" | "skills" | "projects" | "contact",
  CardTitle
> = {
  about: {
    word: "ABOUT",
    rotate: -6,
    x: -6,
    y: -55,
    sizeClass: "text-[clamp(2.7rem,11vw,4.1rem)]",
  },
  skills: {
    word: "SKILLS",
    rotate: 5,
    x: 6,
    y: -62,
  },
  projects: {
    word: "PROJECTS",
    rotate: -8,
    x: -6,
    y: -50,
    sizeClass: "text-[clamp(2.4rem,10vw,3.6rem)]",
  },
  contact: {
    word: "CONTACT",
    rotate: 7,
    x: 10,
    y: -58,
    sizeClass: "text-[clamp(2.6rem,10.5vw,3.9rem)]",
  },
};

/* ------------------------------------------------------------------ */
/* Perlakuan tipografi bersama — satu kit, satu suara                  */
/* ------------------------------------------------------------------ */

/** Header kecil bergaya cetak: kode + nomor artefak */
function PaperHead({ code, no }: { code: string; no: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#20201f]/12 pb-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f5a39]">
        {code}
      </span>
      <span className="font-mono text-[9px] tracking-[0.16em] text-[#777773]">
        FR {no}
      </span>
    </div>
  );
}

/** Caption mono kecil di kaki artefak */
function ArtifactFoot({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={`pt-2.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#777773] ${className}`}
    >
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Sisi belakang cetakan — kertas kosong + stempel + catatan tangan    */
/* Satu keluarga tinta: emas hangat #e8a33d / coklat #6f5a39, opacity  */
/* rendah — stempel lama di kertas, bukan dekorasi mencolok.           */
/* ------------------------------------------------------------------ */

/** Stempel blok — bingkai ganda hairline, tinta coklat-emas redup.
    Rotasi tetap per kartu (deterministik, SSR-safe). */
function BackStamp({
  text,
  rotate,
  className = "",
}: {
  text: string;
  rotate: number;
  className?: string;
}) {
  return (
    <div
      className={`absolute border border-[#6f5a39]/35 p-[3px] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="border border-[#6f5a39]/20 px-2.5 py-1.5">
        <span className="block whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.28em] text-[#6f5a39]/60">
          {text}
        </span>
      </div>
    </div>
  );
}

/** Stempel cincin — lingkaran ganda hairline, tinta emas redup. */
function BackRingStamp({
  center,
  sub,
  rotate,
  size = 72,
  className = "",
}: {
  center: string;
  sub?: string;
  rotate: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`absolute flex items-center justify-center rounded-full border border-[#e8a33d]/40 p-[3px] ${className}`}
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-[#e8a33d]/20">
        <span className="font-display text-[14px] leading-none text-[#e8a33d]/55">
          {center}
        </span>
        {sub && (
          <span className="mt-1 font-mono text-[5.5px] uppercase tracking-[0.3em] text-[#6f5a39]/50">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

/** Catatan "tangan" — italic body sedikit miring (tanpa font baru) +
    tanggal coret kecil di bawahnya. */
function HandNote({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      <p
        className="max-w-[250px] font-body text-[13px] italic leading-[1.6] text-[#20201f]/75"
        style={{ transform: "rotate(-1.5deg)" }}
      >
        {children}
      </p>
      <p
        className="mt-1.5 font-body text-[10px] italic text-[#6f5a39]/55"
        style={{ transform: "rotate(-2.5deg)" }}
      >
        — 02.09
      </p>
    </div>
  );
}

/** Micro-label kaki sisi belakang — senada ArtifactFoot. */
function BackFoot({ text }: { text: string }) {
  return (
    <p className="absolute bottom-3.5 left-0 right-0 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-[#777773]">
      {text}
    </p>
  );
}

/* Back per kartu — posisi & rotasi bervariasi agar tidak seragam;
   80% kertas dibiarkan kosong. */

function AboutCardBack() {
  return (
    <div className="relative h-full w-full">
      <BackStamp
        text="TERCETAK 2026 · STUDIO ANJAL"
        rotate={-8}
        className="left-6 top-8"
      />
      <BackRingStamp
        center="01"
        sub="FRAME"
        rotate={10}
        size={64}
        className="right-6 top-6"
      />
      <HandNote className="bottom-16 left-6">
        frame favorit roll ini — cahaya jatuh pas hari itu
      </HandNote>
      <BackFoot text="BACK OF PRINT — 01/04" />
    </div>
  );
}

function SkillsCardBack() {
  return (
    <div className="relative h-full w-full">
      <BackRingStamp
        center="10"
        sub="FRAMES"
        rotate={-12}
        size={84}
        className="left-7 top-7"
      />
      <BackStamp
        text="ROLL 01 · CONTACT SHEET"
        rotate={6}
        className="right-5 top-24"
      />
      <HandNote className="bottom-20 left-6">
        sepuluh frame, sepuluh senjata
      </HandNote>
      <BackFoot text="BACK OF PRINT — 02/04" />
    </div>
  );
}

function ProjectsCardBack() {
  return (
    <div className="relative h-full w-full">
      <BackStamp
        text="ROLL 02 · SHOT LIST"
        rotate={-7}
        className="left-6 top-8"
      />
      <BackRingStamp
        center="03"
        sub="SHOT"
        rotate={12}
        size={64}
        className="right-6 top-6"
      />
      <HandNote className="bottom-16 left-6">
        tiga shot, tiga cerita — eksekusi nyata menyusul
      </HandNote>
      <BackFoot text="BACK OF PRINT — 03/04" />
    </div>
  );
}

function ContactCardBack() {
  return (
    <div className="relative h-full w-full">
      <BackRingStamp
        center="OPEN"
        rotate={8}
        size={84}
        className="right-7 top-7"
      />
      <BackStamp
        text="STUDIO CARD · ANJAL"
        rotate={-6}
        className="left-6 top-24"
      />
      <HandNote className="bottom-20 left-6">
        pintu studio selalu terbuka
      </HandNote>
      <BackFoot text="BACK OF PRINT — 04/04" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ABOUT — cetakan foto klasik (satu-satunya dengan foto)              */
/* ------------------------------------------------------------------ */

export function AboutCard() {
  return (
    <div>
      <PaperHead code="About" no="01" />

      {/* Foto di dalam area bingkai — rasio 3/2 (landscape) agar kartu
          muat vertikal di viewport pendek; sedikit diturunkan (mt-6)
          di dalam bingkai agar komposisi cetakan lebih seimbang.
          Bingkai putih + strip bawah disediakan chrome "print". */}
      <div className="mt-9 bg-[#f1f1ed] shadow-[0_1px_2px_rgb(32_32_31_/_10%)]">
        <div className="relative aspect-[3/2] overflow-hidden">
          <Image
            src="/me.jpg"
            alt="Foto profil"
            fill
            className="object-cover"
            sizes="(max-width: 640px) calc(100vw - 4rem), 332px"
          />
        </div>
      </div>

      <h3 className="mt-4 font-display text-[21px] leading-tight text-[#20201f]">
        Tentang Saya
      </h3>
      <p className="mt-2 font-body text-[13px] leading-[1.55] text-[#4c4c49]">
        Creative developer dengan fokus pada pengalaman web interaktif.
        Menggabungkan desain, teknologi, dan storytelling untuk produk
        digital yang hidup — saat ini mengeksplorasi web 3D dan motion.
      </p>
      <ArtifactFoot text="Kodak Portra 400 — Frame 01" className="mt-4" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SKILLS — contact sheet: grid frame film bernomor (kosong/geometris) */
/* ------------------------------------------------------------------ */

export function SkillsCard() {
  const skills = [
    "TypeScript",
    "React",
    "Next.js",
    "Three.js",
    "R3F",
    "GSAP",
    "Tailwind",
    "Node.js",
    "GLSL",
    "Blender",
  ];

  return (
    <div>
      <PaperHead code="Skills" no="02" />
      <h3 className="mt-4 font-display text-[21px] leading-tight text-[#20201f]">
        Keahlian
      </h3>

      {/* Contact sheet — frame kosong geometris: hairline cell, nomor
          frame kecil di sudut, nama skill di tengah. Sel dipendekkan
          (h-11, 2×5) agar seluruh sheet muat di viewport pendek. */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {skills.map((skill, i) => (
          <div
            key={skill}
            className="relative flex h-11 items-center justify-center border border-[#20201f]/12 bg-white"
          >
            <span className="absolute left-1 top-0.5 font-mono text-[7px] tracking-[0.14em] text-[#a4a49f]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="px-2 text-center font-body text-[11px] leading-tight text-[#20201f]">
              {skill}
            </span>
          </div>
        ))}
      </div>

      <ArtifactFoot text="Roll 01 — Contact Sheet" className="mt-4" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PROJECTS — shot list / negative strip: baris SHOT dengan sprocket   */
/* ------------------------------------------------------------------ */

export function ProjectsCard() {
  const projects = [
    {
      name: "Interactive Data Atlas",
      desc: "Visualisasi data geospasial real-time berbasis WebGL.",
      link: "#",
    },
    {
      name: "Generative Brand Studio",
      desc: "Tool generatif identitas visual untuk brand kecil.",
      link: "#",
    },
    {
      name: "Spatial UI Prototype",
      desc: "Eksperimen antarmuka spasial di WebXR.",
      link: "#",
    },
  ];

  return (
    <div>
      <PaperHead code="Projects" no="03" />
      <h3 className="mt-4 font-display text-[21px] leading-tight text-[#20201f]">
        Proyek Pilihan
      </h3>

      {/* Strip film vertikal di margin kiri: sprocket hairline — satu
          kolom kotak kecil di antara dua garis sepanjang tinggi baris. */}
      <div className="mt-3 flex gap-3.5">
        <div
          aria-hidden
          className="flex w-[18px] shrink-0 flex-col justify-around border-y border-[#20201f]/10"
        >
          {projects.map((p) => (
            <div key={p.name} className="flex flex-1 items-center">
              <div className="flex flex-col gap-[3px]">
                <span className="block h-[5px] w-[8px] border border-[#20201f]/25" />
                <span className="block h-[5px] w-[8px] border border-[#20201f]/25" />
              </div>
            </div>
          ))}
        </div>

        {/* Shot list — tiap proyek = satu "shot": nomor SHOT, nama,
            deskripsi satu baris, tautan */}
        <ul className="flex-1 divide-y divide-[#20201f]/10">
          {projects.map((p, index) => (
            <li key={p.name} className="py-2.5 first:pt-1">
              <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#a4a49f]">
                Shot {String(index + 1).padStart(2, "0")}
              </span>
              <a
                href={p.link}
                className="mt-0.5 flex items-baseline font-display text-[15px] font-semibold text-[#20201f] underline decoration-[#20201f]/25 underline-offset-4 transition-colors hover:decoration-[#6f5a39]"
              >
                {p.name}
              </a>
              <p className="mt-0.5 font-body text-[11px] leading-[1.45] text-[#5a5a56]">
                {p.desc}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <ArtifactFoot text="Roll 02 — Shot List" className="mt-4" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CONTACT — kartu nama studio: nama, peran, item kontak + dividers    */
/* ------------------------------------------------------------------ */

export function ContactCard() {
  return (
    <div>
      <PaperHead code="Contact" no="04" />

      {/* Kepala kartu nama: monogram + identitas studio */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h3 className="font-display text-[21px] leading-tight text-[#20201f]">
            Mari Terhubung
          </h3>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-[#777773]">
            Studio Anjal — Creative Developer
          </p>
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#20201f]/20 font-display text-[12px] text-[#20201f]">
          A
        </span>
      </div>

      <p className="mt-3 font-body text-[13px] leading-[1.55] text-[#4c4c49]">
        Terbuka untuk kolaborasi, freelance, atau sekadar diskusi soal
        web 3D dan creative coding.
      </p>

      {/* Item kontak — daftar kertas dengan divider hairline */}
      <div className="mt-3 divide-y divide-[#20201f]/10 border-t border-[#20201f]/10">
        <a
          href="mailto:email@you.dev"
          className="flex items-center justify-between py-2 font-display text-[14px] text-[#20201f] underline decoration-[#20201f]/25 underline-offset-4 transition-colors hover:text-[#6f5a39]"
        >
          <span>email@you.dev</span>
          <span
            aria-hidden
            className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#a4a49f]"
          >
            Mail
          </span>
        </a>
        <a
          href="https://github.com/yourname"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-2 font-body text-[12px] text-[#4c4c49] underline decoration-[#20201f]/20 underline-offset-4 transition-colors hover:text-[#6f5a39]"
        >
          <span>GitHub ↗</span>
          <span
            aria-hidden
            className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#a4a49f]"
          >
            Repo
          </span>
        </a>
        <a
          href="#"
          className="flex items-center justify-between py-2 font-body text-[12px] text-[#4c4c49] underline decoration-[#20201f]/20 underline-offset-4 transition-colors hover:text-[#6f5a39]"
        >
          <span>Unduh CV →</span>
          <span
            aria-hidden
            className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#a4a49f]"
          >
            PDF
          </span>
        </a>
      </div>

      <ArtifactFoot text="Studio Card — Cetak 2026" className="mt-4" />
    </div>
  );
}

export default function ContentCards() {
  return (
    <>
      {/* Kilatan kamera + suara shutter saat section berkartu aktif */}
      <CameraFlash />

      {/* Kemiringan photo paper — beda tiap kartu; judul display
          menumpang tepi atas dengan rotasi bebas per kartu. Sisi
          belakang: stempel + catatan, terlihat selama luncuran
          sebelum flip ke depan. */}
      <ContentCard
        section="about"
        side="right"
        tilt={-1.2}
        cardTitle={CARD_TITLES.about}
        back={<AboutCardBack />}
      >
        <AboutCard />
      </ContentCard>
      <ContentCard
        section="skills"
        side="left"
        tilt={0.8}
        variant="sheet"
        cardTitle={CARD_TITLES.skills}
        back={<SkillsCardBack />}
      >
        <SkillsCard />
      </ContentCard>
      <ContentCard
        section="projects"
        side="right"
        tilt={-1.5}
        variant="strip"
        cardTitle={CARD_TITLES.projects}
        back={<ProjectsCardBack />}
      >
        <ProjectsCard />
      </ContentCard>
      <ContentCard
        section="contact"
        side="left"
        tilt={1.4}
        variant="card"
        cardTitle={CARD_TITLES.contact}
        back={<ContactCardBack />}
      >
        <ContactCard />
      </ContentCard>
    </>
  );
}
