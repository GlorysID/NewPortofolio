/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // drei diekspor sebagai barrel file — granularisasi import saat
    // build: graph modul lebih ramping, build lebih cepat, First Load
    // lebih ringan. Aman untuk hosting (Vercel menjalankan build ini).
    optimizePackageImports: ["@react-three/drei"],
  },
};

export default nextConfig;
