import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { buildMediaIndex, resolveMedia } from "./media-index";

/**
 * getCertificates — loader konten sertifikat dinding kiri (SERVER-ONLY).
 *
 * Jangan import modul ini dari client component — memakai node:fs.
 * Dipanggil hanya dari Route Handler static (`app/certificates-data/`).
 *
 * FORMAT (form-only, tanpa body): wajib title/issuer/year/image;
 * opsional link. Media: content/certificates/media/** →
 * /certificates-media/** (preferensi webp via media-index bersama).
 * File tak valid di-warn + dilewati — TIDAK PERNAH menjatuhkan build.
 * Diurutkan by filename; maks 12 dirender (MAX_CERTS di hook).
 */

/** Field frontmatter wajib — file tanpa ini di-skip dengan warning.
    `issuer` OPSIONAL (tidak ditampilkan di kartu). */
export const REQUIRED_CERT_FIELDS = [
  "title",
  "year",
  "image",
] as const;

export interface RawCertificate {
  id: string;
  title: string;
  /** Opsional — tidak ditampilkan di section sertifikat */
  issuer?: string;
  year: string;
  /** URL publik gambar (webp preference, /certificates-media/…) */
  image: string;
  link?: string;
}

export function getCertificates(): RawCertificate[] {
  const dir = path.join(process.cwd(), "content", "certificates");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();

  const mediaIndex = buildMediaIndex([
    [
      path.join(process.cwd(), "public", "certificates-media"),
      "certificates-media",
    ],
    [
      path.join(process.cwd(), "content", "certificates", "media"),
      "certificates-media",
    ],
  ]);

  const certs: RawCertificate[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data } = matter(raw);

      const title = typeof data.title === "string" ? data.title : "";
      const issuer = typeof data.issuer === "string" ? data.issuer : "";
      const year = typeof data.year === "string" ? data.year : "";
      const link =
        typeof data.link === "string" && data.link.length > 0
          ? data.link
          : undefined;
      // image DIEKSTRAK DULU — dipakai filter `missing` di bawahnya
      const image =
        typeof data.image === "string" && data.image.length > 0
          ? data.image
          : "";

      const missing = REQUIRED_CERT_FIELDS.filter((field) => {
        const value: Record<string, string> = { title, year, image };
        return !value[field];
      });
      if (missing.length > 0 || !image) {
        console.warn(
          `[certificates] Lewati ${file} — frontmatter wajib kosong: ${[...missing, ...(image ? [] : ["image"])].join(", ")}`,
        );
        continue;
      }

      const imageResolved = resolveMedia(mediaIndex, image, "certificates");
      if (!imageResolved) continue; // gambar wajib — miss = skip file

      certs.push({
        id: file.replace(/\.mdx$/, ""),
        title,
        issuer,
        year,
        image: imageResolved,
        link,
      });
    } catch (err) {
      console.warn(`[certificates] Gagal parse ${file}:`, err);
    }
  }
  return certs;
}
