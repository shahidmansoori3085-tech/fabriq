import { ImageResponse } from "next/og";

/**
 * FabriQ's app icon, in the two sizes Android needs before it will offer
 * "Install app" (192 and 512 px). Full-bleed square — the phone cuts its own
 * rounded or circular shape — with the mark inside the central safe zone, so
 * the same image works as a normal and a "maskable" icon.
 */
const SIZES = [192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((s) => ({ id: String(s), size: { width: s, height: s }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const s = Number(await id) || 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#e8590c", color: "#ffffff", fontSize: Math.round(s * 0.42), fontWeight: 800,
          letterSpacing: -Math.round(s * 0.01),
        }}
      >
        FQ
      </div>
    ),
    { width: s, height: s },
  );
}
