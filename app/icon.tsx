import { ImageResponse } from "next/og";

// FabriQ's own mark — the tab and the home screen showed the Next.js logo.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#e8590c", color: "#ffffff", fontSize: 300, fontWeight: 800, borderRadius: 96,
        }}
      >
        FQ
      </div>
    ),
    { ...size },
  );
}
