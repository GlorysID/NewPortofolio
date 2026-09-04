"use client";

import { MDXRemote } from "next-mdx-remote";
import type { ComponentProps } from "react";

/**
 * MdxBody — pembungkus tipis MDXRemote. Dimuat via next/dynamic
 * ssr:false dari ProjectOverlay: paket next-mdx-remote ESM-nya rapuh
 * di bundle prerender server, dan jendela quest memang hanya hidup
 * setelah klik (client-only). Props = hasil serialize() build-time.
 */
export default function MdxBody(props: ComponentProps<typeof MDXRemote>) {
  return <MDXRemote {...props} />;
}
