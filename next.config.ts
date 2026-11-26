import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Short links for each place the app is shared. The bio or poster shows a
  // clean link (…/i); the redirect adds the source, which the app counts as
  // a view of /from/<source> (see lib/track.ts). Temporary (307), so a source
  // can be renamed later without browsers holding on to it.
  async redirects() {
    return [
      { source: "/i", destination: "/?utm_source=instagram", permanent: false },
      // a fabricator's Instagram bio (collab reels), counted apart from our own
      { source: "/f", destination: "/?utm_source=ig", permanent: false },
    ];
  },
  // The service worker must never be cached itself, or a phone keeps running
  // an old one after a deploy.
  async headers() {
    return [
      // Safety on every page (2026-11-24 security check): no other site may show the app inside
      // its own page (clickjacking), the browser takes each file for what it says it is, other
      // sites are not told which page linked to them, and the camera, microphone and location
      // stay off (the app never asks for them; sharing keeps working).
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      // the live build's name must never come from a cache
      { source: "/version.json", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
