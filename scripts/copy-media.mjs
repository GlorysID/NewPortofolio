import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

/**
 * copy-media.mjs — salin + kompres media ke public saat PREBUILD.
 * Dua pasangan: proyek (content/projects/media → public/projects-media)
 * dan sertifikat (content/certificates/media → public/certificates-media).
 *
 * Per pasangan:
 * 1) COPY pass — rekursif (root folder termasuk); original ikut
 *    (sumber lossless).
 * 2) COMPRESS pass — raster (*.png/jpg/jpeg/webp) di atas ambang
 *    (sisi > 640px ATAU > 150KB) → resize max-edge 640 + WebP q82 →
 *    <name>.<hash8>.webp (cache-busting: URL webp unik per konten —
 *    ganti gambar = URL baru, browser tak pernah menyajikan versi
 *    basi). SVG & video dilewatkan (svg = vector; video: ≤8MB atau
 *    YouTube — lihat README).
 * Idempoten: folder dest dibersihkan tiap run. Tanpa dep runtime.
 */

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const MAX_EDGE = 640;
const MAX_BYTES = 150 * 1024;
const WEBP_QUALITY = 82;

const PAIRS = [
  {
    src: path.join(process.cwd(), "content", "projects", "media"),
    dest: path.join(process.cwd(), "public", "projects-media"),
    label: "[copy-media]",
  },
  {
    src: path.join(process.cwd(), "content", "certificates", "media"),
    dest: path.join(process.cwd(), "public", "certificates-media"),
    label: "[copy-media][certs]",
  },
];

async function processPair({ src, dest, label }) {
  // Bersihkan output lama (idempoten)
  fs.rmSync(dest, { recursive: true, force: true });
  if (!fs.existsSync(src)) {
    console.log(`${label} folder media tidak ada — dilewati.`);
    return;
  }

  // 1) COPY pass — rekursif (root file termasuk)
  const files = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? path.join(rel, e.name) : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), relPath);
      else files.push(relPath);
    }
  };
  walk(src, "");
  for (const rel of files) {
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, rel), to);
  }
  console.log(`${label} ${files.length} file disalin.`);

  // 2) COMPRESS pass
  let made = 0;
  let skipped = 0;
  for (const rel of files.filter((f) => IMAGE_RE.test(f))) {
    const buf = fs.readFileSync(path.join(dest, rel));
    const meta = await sharp(buf).metadata();
    if (buf.length <= MAX_BYTES && meta.width <= MAX_EDGE) {
      skipped += 1;
      continue;
    }
    const out = await sharp(buf)
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const hash8 = crypto
      .createHash("sha1")
      .update(out)
      .digest("hex")
      .slice(0, 8);
    const webpPath = rel.replace(IMAGE_RE, `.${hash8}.webp`);
    fs.writeFileSync(path.join(dest, webpPath), out);
    made += 1;
    console.log(
      `${label} webp ${rel} → ${webpPath.replace(/\\/g, "/")} (${Math.round(buf.length / 1024)}KB → ${Math.round(out.length / 1024)}KB)`,
    );
  }
  console.log(`${label} ${made} webp dibuat, ${skipped} dilewati (sudah kecil).`);
}

for (const pair of PAIRS) {
  await processPair(pair);
}
