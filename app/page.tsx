import dynamic from "next/dynamic";
import Hero from "@/sections/Hero";
import About from "@/sections/About";
import Skills from "@/sections/Skills";
import Projects from "@/sections/Projects";
import Contact from "@/sections/Contact";
import ScrollProgressController from "@/components/ScrollProgressController";
import LoadingScreen from "@/components/LoadingScreen";
import ContentCards from "@/components/ContentCards";
import FilmGrain from "@/components/FilmGrain";
import SectionRail from "@/components/SectionRail";
import ProjectOverlay from "@/components/ProjectOverlay";
import SwipeHint from "@/components/SwipeHint";

/**
 * Halaman utama.
 * Experience (Canvas R3F) di-load via next/dynamic ssr:false agar
 * tidak konflik dengan server-side render — semua komponen yang
 * memakai R3F/hooks/window berjalan client-only.
 * Sections DOM di-render normal di atasnya sebagai konten scroll.
 */
const Experience = dynamic(() => import("@/components/Experience"), {
  ssr: false,
});

export default function Home() {
  return (
    <main id="main-scroll" className="relative min-h-screen overflow-x-hidden bg-black text-text">
      {/* Scene 3D fixed di belakang (background void hitam pekat) */}
      <Experience />

      {/* Infrastruktur scroll: GSAP ScrollTrigger scrub → store */}
      <ScrollProgressController />

      {/* Loading screen saat model/texture loading (fase 5) */}
      <LoadingScreen />

      {/* Overlay kartu konten 2D per section (di atas Canvas, z-20) */}
      <ContentCards />

      {/* Film grain halus — menyatukan scan realistis dengan latar
          digital (z-15: di atas canvas & teks section, di bawah kartu) */}
      <FilmGrain />

      {/* Rail section — pengganti scrollbar native (fixed kanan, z-30,
          di bawah enter gate & kilatan kamera) */}
      <SectionRail />

      {/* Jendela quest MMORPG untuk proyek papan 3D (z-[36]) + petunjuk
          geser tipis bottom-center (z-30) */}
      <ProjectOverlay />
      <SwipeHint />

      {/* Konten scroll di depan */}
      <div className="relative z-10">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Contact />
      </div>
    </main>
  );
}
