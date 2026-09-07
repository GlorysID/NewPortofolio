import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Avermont House · display serif high-contrast (heading utama).
// ⚠️ PERSONAL USE ONLY · butuh lisensi komersial dari mansgreback.com
// jika portofolio dipakai untuk keperluan komersial.
const avermont = localFont({
  src: "./fonts/AvermontHouse.otf",
  variable: "--font-display",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-alt",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

/**
 * SEO · Next.js Metadata API — domain produksi anjalisaputra.site.
 * Cakupan nama: "Anjali", "Anjali Saputra", "Anjali BM3",
 * "Anjali Portofolio" + varian bahasa Indonesia — nama & alias diweave
 * natural di title/description/keywords dan JSON-LD (lihat PersonJsonLd
 * di bawah), bukan keyword-stuffing.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://www.anjalisaputra.site"),
  title: {
    default: "Anjali Saputra - Portfolio Website",
    template: "%s · Anjali Saputra",
  },
  description:
    "Portofolio resmi Anjali Saputra (Anjali BM3) — Pengembang AI agents, automation systems, dan full-stack web developer dari SMK Bina Mandiri Multimedia (BM3). Kunjungi karya proyek, sertifikat, dan keahlian Anjali Saputra.",
  keywords: [
    "Anjali",
    "Anjali Saputra",
    "Anjali BM3",
    "Anjali Portofolio",
    "Portofolio Anjali",
    "Portofolio Anjali Saputra",
    "Anjali Saputra BM3",
    "Anjali Saputra Portfolio",
    "Anjali SMK BM3",
    "Anjali Bina Mandiri Multimedia",
    "SMK Bina Mandiri Multimedia Anjali",
    "Anjali Saputra Cileungsi",
    "Anjali Saputra Website",
    "anjalisaputra.site",
    "Anjali Developer",
    "Anjali AI",
    "Anjali Automation",
    "Anjali Web Developer",
    "GlorysID",
    "GlorysID GitHub",
    "SMK BM3",
    "Bina Mandiri Multimedia",
    "portofolio web developer indonesia",
    "three.js portfolio anjali",
  ],
  authors: [{ name: "Anjali Saputra", url: "https://anjalisaputra.site" }],
  creator: "Anjali Saputra",
  publisher: "Anjali Saputra",
  category: "technology",
  alternates: {
    canonical: "https://www.anjalisaputra.site",
  },
  openGraph: {
    type: "profile",
    firstName: "Anjali",
    lastName: "Saputra",
    username: "GlorysID",
    gender: "male",
    url: "https://www.anjalisaputra.site",
    title: "Anjali Saputra - Portfolio Website",
    description:
      "Portofolio resmi Anjali Saputra (Anjali BM3) — AI agents, automation systems, dan web development dalam pengalaman 3D sinematik interaktif.",
    siteName: "Anjali Saputra — Portofolio",
    locale: "id_ID",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Anjali Saputra - Portfolio Website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anjali Saputra - Portfolio Website",
    description:
      "Portofolio resmi Anjali Saputra (Anjali BM3) — AI agents, automation systems, dan web development dalam pengalaman 3D sinematik.",
    images: ["/opengraph-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "Z3ogxtmPlQGBI4L-5LyLfi33aODKPZHYTQsPYuCqM5U",
  },
};

/**
 * JSON-LD — Person + WebSite + ProfilePage.
 * Menghubungkan entitas "Anjali Saputra", "Anjali", dan "Anjali BM3"
 * dengan sekolah (SMK Bina Mandiri Multimedia / BM3) dan akun GitHub/IG
 * untuk Google Knowledge Graph dan Google Search sitelinks.
 */
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://anjalisaputra.site/#person",
  name: "Anjali Saputra",
  givenName: "Anjali",
  familyName: "Saputra",
  additionalName: "BM3",
  alternateName: [
    "Anjali",
    "Anjali BM3",
    "Anjali Saputra BM3",
    "Anjali Portofolio",
    "Portofolio Anjali",
    "Portofolio Anjali Saputra",
    "Anjali Saputra Portfolio",
    "GlorysID",
  ],
  jobTitle: "AI, Automation & Web Developer",
  description:
    "Pengembang AI agents, automation systems, dan full-stack web developer asal Indonesia. Siswa SMK Bina Mandiri Multimedia (SMK BM3 Cileungsi).",
  url: "https://www.anjalisaputra.site",
  image: "https://www.anjalisaputra.site/me.jpg",
  email: "mailto:anjalisaputra@gmail.com",
  gender: "Male",
  nationality: {
    "@type": "Country",
    name: "Indonesia",
  },
  alumniOf: [
    {
      "@type": "EducationalOrganization",
      name: "SMK Bina Mandiri Multimedia",
      alternateName: ["SMK BM3", "BM3", "SMK Bina Mandiri Multimedia Cileungsi"],
      url: "https://smkbm3.sch.id",
    },
    {
      "@type": "EducationalOrganization",
      name: "SMP Negeri 03 Cileungsi",
      alternateName: ["SMPN 3 Cileungsi"],
    },
    {
      "@type": "EducationalOrganization",
      name: "SDN Limusnunggal 01",
    },
  ],
  sameAs: [
    "https://github.com/GlorysID",
    "https://instagram.com/jalipryyy",
  ],
  knowsAbout: [
    "Artificial Intelligence",
    "AI Agents",
    "Workflow Automation",
    "Web Development",
    "Next.js",
    "React",
    "TypeScript",
    "Python",
    "Three.js",
    "Node.js",
    "Tailwind CSS",
  ],
};

const profilePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": "https://www.anjalisaputra.site/#profilepage",
  url: "https://www.anjalisaputra.site",
  name: "Anjali Saputra - Portfolio Website",
  description:
    "Portofolio resmi Anjali Saputra (Anjali BM3) — Siswa SMK Bina Mandiri Multimedia (BM3). Menampilkan karya AI agents, sistem otomasi, dan web development 3D interaktif.",
  primaryImageOfPage: "https://www.anjalisaputra.site/opengraph-image.png",
  inLanguage: "id-ID",
  mainEntity: { "@id": "https://www.anjalisaputra.site/#person" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.anjalisaputra.site/#website",
  url: "https://www.anjalisaputra.site",
  name: "Anjali Saputra — Portofolio",
  alternateName: [
    "Anjali",
    "Anjali BM3",
    "Anjali Portofolio",
    "Portofolio Anjali",
    "Anjali Saputra Portfolio",
    "anjalisaputra.site",
    "www.anjalisaputra.site",
  ],
  inLanguage: ["id-ID", "en-US"],
  about: { "@id": "https://www.anjalisaputra.site/#person" },
  author: { "@id": "https://www.anjalisaputra.site/#person" },
  publisher: { "@id": "https://www.anjalisaputra.site/#person" },
};

/** Viewport mobile (Lane B): device-width + scale 1 tanpa zoom user
 * (gesture system mengelola interaksi), viewport-fit cover untuk
 * safe-area iOS (env(safe-area-inset-*)), tema hitam senada latar. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${avermont.variable} ${display.variable} ${body.variable} bg-black font-body text-text antialiased`}
      >
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
