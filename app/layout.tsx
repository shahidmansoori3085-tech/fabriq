import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { CloudAutoSync } from "@/components/cloud";

const DESCRIPTION =
  "Enter window, door and partition sizes — get the pipes to buy, glass sizes and a cutting sheet instantly.";

export const metadata: Metadata = {
  // absolute links for the share preview (WhatsApp, Instagram) and its image
  metadataBase: new URL("https://app-six-lilac-20.vercel.app"),
  title: "FabriQ — Aluminium material list & cutting sheet",
  description: DESCRIPTION,
  applicationName: "FabriQ",
  openGraph: {
    type: "website",
    siteName: "FabriQ by Indian Steels",
    title: "FabriQ — Size daalo, material list turant",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        {/* visitor counts in Vercel → Analytics (no cookies, nothing personal) */}
        <Analytics />
        {/* save online in the background once the shop has logged in (off until cloud is set up) */}
        <CloudAutoSync />
      </body>
    </html>
  );
}
