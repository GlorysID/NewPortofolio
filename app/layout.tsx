import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Avermont House — display serif high-contrast (heading utama).
// ⚠️ PERSONAL USE ONLY — butuh lisensi komersial dari mansgreback.com
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
 * SEO dasar (fase 6) — Next.js Metadata API.
 * metadataBase untuk resolusi URL absolut OG image.
 * GANTI yourname.dev → domain asli setelah deploy.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://yourname.dev"),
  title: {
    default: "Anjali Saputra — Portfolio",
    template: "%s — Anjali Saputra",
  },
  description:
    "Portofolio interaktif 3D Anjali Saputra — AI agents, automation systems, dan web development. Kamera sinematik menyoroti tiap sisi: tentang, keahlian, perjalanan sekolah, dan papan proyek.",
  keywords: [
    "Anjali Saputra",
    "portfolio",
    "AI agents",
    "automation",
    "web development",
    "three.js",
    "react three fiber",
  ],
  openGraph: {
    type: "website",
    url: "/",
    title: "Anjali Saputra — Portfolio",
    description:
      "AI × Automation × Software — pengalaman portofolio 3D interaktif.",
    siteName: "Anjali Saputra — Portfolio",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Anjali Saputra — Portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anjali Saputra — Portfolio",
    description: "AI × Automation × Software — portofolio 3D interaktif.",
    images: ["/opengraph-image.png"],
  },
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
      </body>
    </html>
  );
}
