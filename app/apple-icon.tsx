import { ImageResponse } from "next/og";

// iPhone home-screen icon (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#e8590c", color: "#ffffff", fontSize: 104, fontWeight: 800,
        }}
      >
        FQ
      </div>
    ),
    { ...size },
  );
}
