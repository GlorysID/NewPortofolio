"use client";

import { MDXRemote } from "next-mdx-remote";
import type { ComponentProps } from "react";

/**
 * MdxBody — pembungkus MDXRemote dengan prose-lite styling senada
 * kertas quest. Dimuat client-only (next/dynamic ssr:false dari
 * ProjectOverlay). Props = hasil serialize() build-time + components
 * override bila perlu.
 */

type MdxBodyProps = ComponentProps<typeof MDXRemote> & {
  components?: ComponentProps<typeof MDXRemote>["components"];
};

const defaults = {
  h2: (props: ComponentProps<"h2">) => (
    <h2
      className="mt-4 font-display text-[16px] leading-tight text-[#20201f]"
      {...props}
    />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3
      className="mt-4 font-display text-[14px] leading-tight text-[#20201f]"
      {...props}
    />
  ),
  p: (props: ComponentProps<"p">) => (
    <p
      className="mt-2 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul
      className="mt-2 list-disc space-y-1 pl-4 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol
      className="mt-2 list-decimal space-y-1 pl-4 font-body text-[13px] leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
  a: (props: ComponentProps<"a">) => (
    <a
      className="text-[#6f5a39] underline decoration-[#e8a33d]/60 underline-offset-2"
      {...props}
    />
  ),
  strong: (props: ComponentProps<"strong">) => (
    <strong className="font-semibold text-[#20201f]" {...props} />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="mt-2 border-l-2 border-[#e8a33d]/60 pl-3 font-body text-[13px] italic leading-[1.6] text-[#4c4c49]"
      {...props}
    />
  ),
};

export default function MdxBody({ components, ...rest }: MdxBodyProps) {
  return <MDXRemote {...rest} components={{ ...defaults, ...components }} />;
}
