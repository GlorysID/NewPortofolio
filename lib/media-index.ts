import fs from "node:fs";
import path from "node:path";

/**
 * media-index — indeks file media bersama untuk loader projects &
 * certificates (SERVER-ONLY — node:fs).
 *
 * Dua root, DIURUTKAN (output dulu):
 *   1) public/<base>/**  — hasil prebuild copy-media.mjs (mengandung
 *      varian .webp hasil kompresi sharp),
 *   2) content/<base>/** — sumber lossless (fallback dev).
 * First match wins → varian .webp otomatis menang atas original.
 */

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

export function buildMediaIndex(
  roots: Array<[string, string]>,
): Map<string, string> {
  const index = new Map<string, string>();
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

/** Nilai absolut (URL) dilewatkan apa adanya. Referensi file raster
    yang punya varian webp di indeks → URL webp (preferensi):
    1) <name>.webp (polos), 2) varian cache-busting ber-hash
    <base>.<hash8>.webp (dibuat copy-media.mjs). */
export function resolveMedia(
  index: Map<string, string>,
  raw: string | undefined,
  warnLabel: string,
): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (IMAGE_RE.test(raw)) {
    const webpName = raw.replace(IMAGE_RE, ".webp");
    if (webpName !== raw && index.has(webpName)) {
      return index.get(webpName);
    }
    const base = raw.replace(IMAGE_RE, "");
    let hashUrl: string | undefined;
    index.forEach((url, name) => {
      if (!hashUrl && name.startsWith(`${base}.`) && name.endsWith(".webp")) {
        hashUrl = url;
      }
    });
    if (hashUrl) return hashUrl;
  }
  const resolved = index.get(raw);
  if (!resolved) {
    console.warn(
      `[media] Media "${raw}" tidak ditemukan (${warnLabel}) — field dikosongkan.`,
    );
    return undefined;
  }
  return resolved;
}
