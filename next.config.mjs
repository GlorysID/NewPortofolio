import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // MDX pipeline (content/projects/*.mdx diparse manual via lib/projects.ts;
  // pageExtensions mdx untuk kemampuan halaman .mdx di masa depan).
  pageExtensions: ["mdx", "md", "tsx", "ts", "jsx", "js"],
  experimental: {
    // drei diekspor sebagai barrel file — granularisasi import saat
    // build: graph modul lebih ramping, build lebih cepat, First Load
    // lebih ringan. Aman untuk hosting (Vercel menjalankan build ini).
    optimizePackageImports: ["@react-three/drei"],
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired.
});

export default withMDX(nextConfig);
