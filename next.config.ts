import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Short links for each place the app is shared. The bio or poster shows a
  // clean link (…/i); the redirect adds the source, which the app counts as
  // a view of /from/<source> (see lib/track.ts). Temporary (307), so a source
  // can be renamed later without browsers holding on to it.
  async redirects() {
    return [
      { source: "/i", destination: "/?utm_source=instagram", permanent: false },
    ];
  },
  // The service worker must never be cached itself, or a phone keeps running
  // an old one after a deploy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
