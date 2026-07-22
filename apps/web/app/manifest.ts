import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Naija Brief",
    short_name: "Naija Brief",
    description:
      "Your Nigeria-first morning news briefing — read aloud across politics, tech, business, markets, sport and the world.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f1e3",
    theme_color: "#0c3b2a",
    categories: ["news", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
