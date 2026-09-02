"use client";

/**
 * FilmGrain — overlay noise halus di atas seluruh viewport (ide #2).
 *
 * - SVG feTurbulence sebagai data-URI background, opacity rendah,
 *   mix-blend overlay → grain hanya "menempel" di area yang
 *   bercahaya (model & lantai), latar hitam murni tetap bersih.
 * - mix-blend-mode & opacity di elemen terluar supaya menyatu dengan
 *   canvas di bawahnya (stacking context root), bukan dengan parent.
 * - Animasi translate dengan steps() — turunan compositor GPU,
 *   tanpa repaint per frame; mati otomatis kalau user memakai
 *   prefers-reduced-motion.
 * - pointer-events-none: tidak menghalangi interaksi apa pun.
 */
export default function FilmGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[15] overflow-hidden"
      style={{ opacity: 0.06, mixBlendMode: "overlay" }}
    >
      <style>{`
        @keyframes grain-shift {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-2%, 3%); }
          50% { transform: translate(3%, -2%); }
          75% { transform: translate(-3%, -3%); }
          100% { transform: translate(0, 0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .grain-anim { animation: grain-shift 0.9s steps(4) infinite; }
        }
      `}</style>
      <div
        className="grain-anim absolute -inset-[10%]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
