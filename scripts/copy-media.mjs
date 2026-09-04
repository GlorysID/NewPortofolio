import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "content", "projects", "media");
const DEST = path.join(process.cwd(), "public", "projects-media");
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const MAX_EDGE = 640;
const MAX_BYTES = 150 * 1024;

fs.rmSync(DEST, { recursive: true, force: true });
if (!fs.existsSync(SRC)) {
  console.log("[copy-media] folder media/ tidak ada — dilewati.");
  process.exit(0);
}

// COPY pass — rekursif; file di root media/ termasuk.
const files = [];
const walk = (dir, rel) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), relPath);
    else files.push(relPath);
  }
};
walk(SRC, "");
for (const rel of files) {
  const to = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), to);
}
console.log(`[copy-media] ${files.length} file disalin.`);

// COMPRESS pass — raster di atas ambang (sisi > 640px ATAU > 150KB)
// → resize max-edge 640 + WebP q82, ditulis sebagai <name>.webp.
let made = 0;
let skipped = 0;
for (const rel of files.filter((f) => IMAGE_RE.test(f))) {
  const buf = fs.readFileSync(path.join(DEST, rel));
  const meta = await sharp(buf).metadata();
  if (buf.length <= MAX_BYTES && meta.width <= MAX_EDGE) {
    skipped += 1;
    continue;
  }
  const webpPath = rel.replace(IMAGE_RE, ".webp");
  const out = await sharp(buf)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  fs.writeFileSync(path.join(DEST, webpPath), out);
  made += 1;
  console.log(
    `[copy-media] webp ${rel} → ${Math.round(buf.length / 1024)}KB → ${Math.round(out.length / 1024)}KB`,
  );
}
console.log(`[copy-media] ${made} webp dibuat, ${skipped} dilewati (sudah kecil).`);
