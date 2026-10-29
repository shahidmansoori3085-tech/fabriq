import type { MetadataRoute } from "next";

/** Installable on the home screen, opening straight into the app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FabriQ — Aluminium material list & cutting sheet",
    short_name: "FabriQ",
    description: "Enter window, door and partition sizes — get the pipes to buy, glass sizes and a cutting sheet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f4f6",
    theme_color: "#ffffff",
    // 192 + 512 are what Android requires to offer "Install app"; the icon
    // is full-bleed with the mark in the safe zone, so it is also maskable.
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
