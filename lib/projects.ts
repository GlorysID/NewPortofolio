import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * getBoardProjects — loader konten proyek papan quest (SERVER-ONLY).
 *
 * Jangan import modul ini dari client component — memakai node:fs.
 * Dipanggil hanya dari Route Handler static (`app/projects-data/`).
 *
 * FORMAT TEMPLATE (form-only): frontmatter wajib title/year/tags/
 * link/summary; body MDX OPSIONAL (tetap di-parse bila ada). Field
 * opsional cover & video divalidasi tipe-saja — file tetap masuk.
 *
 * MEDIA: user drop file di content/projects/media/<folder-bebas>/.
 * Loader memetakan SEMUA file di folder-folder itu (basename → URL
 * publik /projects-media/<folder>/<file>, disalin oleh
 * scripts/copy-media.mjs saat prebuild) lalu menyelesaikan cover/video
 * berdasarkan NAMA FILE — nama folder bebas. Nilai yang sudah berupa
 * URL (http) dilewatkan apa adanya; filename yang tidak ketemu → warn
 * + field dikosongkan (section tersembunyi, bukan error).
 *
 * File tak valid (field wajib kosong) di-warn + dilewati — TIDAK
 * PERNAH menjatuhkan build. Diurutkan by filename.
 */

/** Field frontmatter wajib — file tanpa ini di-skip dengan warning.
    `link` OPSIONAL: project tanpa live site (WIP/sekolah) tetap sah. */
export const REQUIRED_FIELDS = [
  "title",
  "year",
  "tags",
  "summary",
] as const;

/** Bentuk MENTAH hasil loader — body masih MDX string opsional
    (route.ts yang men-serialize bila ada). cover/video sudah berupa
    URL publik final (bukan filename mentah). */
export interface RawBoardProject {
  id: string;
  title: string;
  year: string;
  tags: string[];
  /** Opsional — project tanpa live site (WIP/sekolah) sah tanpa link */
  link?: string;
  /** Opsional — link repo GitHub, CTA kedua di quest window */
  linkGithub?: string;
  summary: string;
  /** Body MDX mentah — "" bila file hanya frontmatter */
  body: string;
  /** URL publik cover (/projects-media/… atau URL absolut) */
  cover?: string;
  /** URL YouTube ATAU URL file video lokal */
  video?: string;
}

/** Indeks media: basename → URL publik. Dua sumber, DIURUTKAN:
    1) public/projects-media/** — output prebuild (mengandung varian
       .webp hasil kompresi; fresh saat next build karena prebuild
       jalan lebih dulu),
    2) content/projects/media/** — sumber (fallback saat dev sebelum
       prebuild pertama / file yang tak ter-copy).
    First match wins → varian .webp otomatis menang atas original. */
function buildMediaIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const roots: Array<[string, string]> = [
    [path.join(process.cwd(), "public", "projects-media"), "projects-media"],
    [
      path.join(process.cwd(), "content", "projects", "media"),
      "projects-media",
    ],
  ];
  for (const [root, urlBase] of roots) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir: string, rel: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), relPath);
        } else if (!index.has(entry.name)) {
          index.set(entry.name, `/${urlBase}/${relPath}`);
        }
      }
    };
    walk(root, "");
  }
  return index;
}

/** URL sudah absolut? (YouTube, CDN, dsb. — dilewatkan apa adanya) */
function isAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function getBoardProjects(): RawBoardProject[] {
  const dir = path.join(process.cwd(), "content", "projects");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .sort();

  const mediaIndex = buildMediaIndex();
  const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
  /** Filename/URL mentah → URL publik final (rules di doc header).
      Preferensi WEBP: bila file cover/video bernama <name>.<ext> punya
      varian <name>.webp di indeks (dibuat scripts/copy-media.mjs saat
      prebuild), URL webp yang dipakai — original tetap tersedia di
      public untuk keperluan lain. */
  const resolveMedia = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    if (isAbsoluteUrl(raw)) return raw;
    if (IMAGE_RE.test(raw)) {
      const webpName = raw.replace(IMAGE_RE, ".webp");
      if (webpName !== raw && mediaIndex.has(webpName)) {
        return mediaIndex.get(webpName);
      }
    }
    const resolved = mediaIndex.get(raw);
    if (!resolved) {
      console.warn(
        `[projects] Media "${raw}" tidak ditemukan di content/projects/media/** — field dikosongkan.`,
      );
      return undefined;
    }
    return resolved;
  };

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

      // Opsional — tipe-saja (bukan kegagalan); resolusi media di atas.
      const cover =
        typeof data.cover === "string" && data.cover.length > 0
          ? data.cover
          : undefined;
      const video =
        typeof data.video === "string" && data.video.length > 0
          ? data.video
          : undefined;
      const linkGithub =
        typeof data["link-github"] === "string" && data["link-github"].length > 0
          ? (data["link-github"] as string)
          : undefined;

      const missing = REQUIRED_FIELDS.filter((field) => {
        const value = { title, year, tags, summary }[field];
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
        linkGithub,
        summary,
        body: content.trim(),
        cover: resolveMedia(cover),
        video: resolveMedia(video),
      });
    } catch (err) {
      console.warn(`[projects] Gagal parse ${file}:`, err);
    }
  }
  return projects;
}
