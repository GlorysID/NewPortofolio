import fs from "node:fs";
import path from "node:path";

/**
 * copy-media.mjs — salin media proyek ke public saat PREBUILD.
 *
 * Alur user: drop file di content/projects/media/<folder>/ (nama folder
 * bebas) + tulis `cover: "cover.png"` / `video: "demo.mp4"` di
 * frontmatter .mdx. Script ini menyalin SEMUA isi media/** ke
 * public/projects-media/** secara rekursif → next start / Vercel
 * menyajikannya statis di /projects-media/<folder>/<file>.
 *
 * - Deterministik & idempoten: public/projects-media dibersihkan dulu
 *   (output lama tidak menumpuk), lalu disalin utuh.
 * - Tanpa dependensi; jalan di Windows/POSIX (path.join + fs.cpSync).
 * - Salinan public/projects-media masuk .gitignore (dihasilkan build),
 *   sumber kebenaran tetap content/projects/media/**.
 */

const SRC = path.join(process.cwd(), "content", "projects", "media");
const DEST = path.join(process.cwd(), "public", "projects-media");

function main() {
  // Bersihkan output lama (idempoten)
  fs.rmSync(DEST, { recursive: true, force: true });

  if (!fs.existsSync(SRC)) {
    console.log("[copy-media] Tidak ada media/ — dilewati.");
    return;
  }

  let files = 0;
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(from, relPath);
      } else {
        const to = path.join(DEST, relPath);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        files += 1;
      }
    }
  };
  walk(SRC, "");

  console.log(`[copy-media] ${files} file → public/projects-media/`);
}

main();
