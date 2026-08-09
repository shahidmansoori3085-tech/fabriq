import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter_Tight } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FabriQ — Sheet ki photo kheencho, material list lo",
  description:
    "Aluminium fabricators ka AI estimator — accurate material list, cutting list aur scrap bachao, 1 minute mein.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#e8590c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
