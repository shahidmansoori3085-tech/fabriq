import type { MetadataRoute } from "next";

/** Installable on the home screen, opening straight into the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FabriQ — Aluminium material list & cutting sheet",
    short_name: "FabriQ",
    description: "Enter window, door and partition sizes — get the pipes to buy, glass sizes and a cutting sheet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
