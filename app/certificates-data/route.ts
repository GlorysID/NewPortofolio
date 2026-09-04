import { NextResponse } from "next/server";
import { getCertificates } from "@/lib/certificates";

/**
 * /certificates-data — JSON statis hasil build dari
 * content/certificates/*.mdx. `force-static` → di-emit sebagai file
 * statis saat `next build` (client fetch membaca file statis — situs
 * tetap SSG murni). Tanpa body MDX — tidak ada serialize.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getCertificates());
}
