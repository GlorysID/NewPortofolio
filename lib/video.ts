/**
 * video.ts — util media video untuk quest window (client-safe).
 */

/** Extract ID video YouTube. Bentuk didukung:
    youtube.com/watch?v=<ID> · youtu.be/<ID> · youtube.com/shorts/<ID>
    (suffix query diabaikan; input di-trim). */
export function extractYouTubeId(raw: string): string | null {
  const url = raw.trim();
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Video lokal? (.mp4/.webm/.mov — case-insensitive, query diizinkan) */
export function isLocalVideo(value: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(value.trim());
}
