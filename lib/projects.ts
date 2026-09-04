import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * getBoardProjects — loader MDX proyek papan quest (SERVER-ONLY).
 *
 * Jangan import modul ini dari client component — memakai node:fs.
 * Dipanggil hanya dari Route Handler static (`app/projects-data/`).
 *
 * Membaca content/projects/*.mdx (file mulai dengan `_` dilewati),
 * parse frontmatter via gray-matter, validasi wajib (title/year/tags/
 * link/summary) — file tak valid di-warn + dilewati, TIDAK PERNAH
 * menjatuhkan build. Diurutkan by filename → id = nama file tanpa
 * ekstensi.
 */

/** Field frontmatter wajib — file tanpa ini di-skip dengan warning. */
export const REQUIRED_FIELDS = [
  "title",
  "year",
  "tags",
  "link",
  "summary",
] as const;

/** Bentuk MENTAH hasil loader — body masih MDX string (belum
    dikompilasi; route.ts yang men-serialize). */
export interface RawBoardProject {
  id: string;
  title: string;
  year: string;
  tags: string[];
  link: string;
  summary: string;
  /** Body MDX mentah dari bawah frontmatter */
  body: string;
  /** Frontmatter opsional — diabaikan pipeline (tanpa image pipeline) */
  cover?: string;
}

export function getBoardProjects(): RawBoardProject[] {
  const dir = path.join(process.cwd(), "content", "projects");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();

  const projects: RawBoardProject[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);

      const title = typeof data.title === "string" ? data.title : "";
      const year = typeof data.year === "string" ? data.year : "";
      const tags = Array.isArray(data.tags)
        ? data.tags.filter((t): t is string => typeof t === "string")
        : [];
      const link = typeof data.link === "string" ? data.link : "";
      const summary = typeof data.summary === "string" ? data.summary : "";

      const missing = REQUIRED_FIELDS.filter((field) => {
        const value = { title, year, tags, link, summary }[field];
        return Array.isArray(value) ? value.length === 0 : !value;
      });
      if (missing.length > 0) {
        console.warn(
          `[projects] Lewati ${file} — frontmatter wajib kosong: ${missing.join(", ")}`,
        );
        continue;
      }

      projects.push({
        id: file.replace(/\.mdx$/, ""),
        title,
        year,
        tags,
        link,
        summary,
        body: content.trim(),
        cover: typeof data.cover === "string" ? data.cover : undefined,
      });
    } catch (err) {
      console.warn(`[projects] Gagal parse ${file}:`, err);
    }
  }
  return projects;
}
