import { NextResponse } from "next/server";
import { serialize } from "next-mdx-remote/serialize";
import { getBoardProjects } from "@/lib/projects";

/**
 * /projects-data — JSON statis hasil build dari content/projects/*.mdx.
 *
 * `force-static` → route handler di-emit sebagai file statis saat
 * `next build` (client fetch membaca file statis — situs tetap SSG
 * murni, tanpa server runtime). Body MDX DIKOMPILASI di sini (build
 * time, `serialize` next-mdx-remote) → client tinggal hydrate, tanpa
 * kompilasi runtime.
 */
export const dynamic = "force-static";

export async function GET() {
  const projects = await Promise.all(
    getBoardProjects().map(async ({ body, ...rest }) => ({
      ...rest,
      compiled: await serialize(body),
    })),
  );
  return NextResponse.json(projects);
}
