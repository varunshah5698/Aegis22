import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name} — cross-border AML monitoring`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F4F4EF",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#F0B250",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "#14151A",
            }}
          >
            S
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#14151A" }}>{siteConfig.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: "#4A4D57",
              border: "2px solid rgba(20,21,26,0.2)",
              borderRadius: 999,
              padding: "8px 18px",
              alignSelf: "flex-start",
            }}
          >
            Real-time AML monitoring for cross-border payments
          </div>
          <div
            style={{
              fontSize: 72,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              fontWeight: 700,
              color: "#14151A",
              maxWidth: 980,
            }}
          >
            Catch illicit cross-border flows before they settle.
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, fontSize: 22, color: "#4A4D57" }}>
          <span>10 explainable risk signals</span>
          <span>·</span>
          <span>Sub-200 ms median scoring</span>
          <span>·</span>
          <span>Alert to SAR-style report</span>
        </div>
      </div>
    ),
    size,
  );
}
