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
  metadataBase: new URL("https://anjalisaputra.site"),
  title: {
    default:
      "Anjali Saputra — Portofolio 3D Interaktif · AI, Automation & Web Developer",
    template: "%s · Anjali Saputra",
  },
  description:
    "Portofolio resmi Anjali Saputra (Anjali BM3) — AI agents, automation systems, dan web development dalam pengalaman 3D sinematik interaktif. Kenali karya, keahlian, dan perjalanan Anjali Saputra.",
  keywords: [
    "Anjali",
    "Anjali Saputra",
    "Anjali BM3",
    "Anjali Portofolio",
    "Portofolio Anjali",
    "Anjali Saputra Portfolio",
    "Anjali Saputra Web Developer",
    "Anjali Saputra AI",
    "portofolio web developer",
    "AI agents",
    "automation systems",
    "web development Indonesia",
    "three.js portfolio",
    "react three fiber",
  ],
  authors: [{ name: "Anjali Saputra", url: "https://anjalisaputra.site" }],
  creator: "Anjali Saputra",
  publisher: "Anjali Saputra",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://anjalisaputra.site",
    title:
      "Anjali Saputra — Portofolio 3D Interaktif · AI, Automation & Web Developer",
    description:
      "Portofolio resmi Anjali Saputra (Anjali BM3) — AI agents, automation systems, dan web development dalam pengalaman 3D sinematik interaktif.",
    siteName: "Anjali Saputra — Portofolio",
    locale: "id_ID",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Anjali Saputra — Portofolio 3D Interaktif",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anjali Saputra — Portofolio 3D Interaktif",
    description:
      "Portofolio resmi Anjali Saputra (Anjali BM3) — AI, automation & web development dalam pengalaman 3D sinematik.",
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
};

/**
 * JSON-LD — Person + WebSite. Ini yang memberi tahu mesin pencari
 * identitas & alias resmi ("Anjali BM3", "Anjali") sehingga query
 * variasi nama terhubung ke satu entitas yang sama (knowledge panel /
 * sitelinks). Data diambil dari kartu kontak site (GitHub/IG/email).
 */
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://anjalisaputra.site/#person",
  name: "Anjali Saputra",
  alternateName: ["Anjali", "Anjali BM3", "Anjali Portofolio"],
  jobTitle: "AI, Automation & Web Developer",
  description:
    "Pengembang AI agents, automation systems, dan web development — portofolio 3D sinematik interaktif.",
  url: "https://anjalisaputra.site",
  email: "mailto:anjalisaputra@gmail.com",
  sameAs: [
    "https://github.com/GlorysID",
    "https://instagram.com/jalipryyy",
  ],
  knowsAbout: [
    "Artificial Intelligence",
    "AI Agents",
    "Workflow Automation",
    "Web Development",
    "Three.js",
    "React",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://anjalisaputra.site/#website",
  url: "https://anjalisaputra.site",
  name: "Anjali Saputra — Portofolio",
  alternateName: ["Anjali BM3 Portfolio", "Anjali Portofolio"],
  inLanguage: "id-ID",
  about: { "@id": "https://anjalisaputra.site/#person" },
  author: { "@id": "https://anjalisaputra.site/#person" },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
