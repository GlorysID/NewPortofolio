import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anjali Saputra — Portofolio",
    short_name: "Anjali Saputra",
    description:
      "Portofolio 3D interaktif Anjali Saputra — AI, Automation & Web Developer",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
