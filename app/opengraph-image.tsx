import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Wardy BIP - Brigade des Inspecteurs de Profils !";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#01030f",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #172554 0%, #020617 70%)",
            opacity: 0.9,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 82,
              fontWeight: 900,
              letterSpacing: "-3px",
              color: "#ffffff",
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            WARDY BIP
          </div>

          <div
            style={{
              marginTop: 20,
              padding: "12px 30px",
              borderRadius: 999,
              background: "#f56606",
              color: "#020617",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            Brigade des Inspecteurs de Profils !
          </div>

          <div
            style={{
              marginTop: 35,
              fontSize: 28,
              color: "#94a3b8",
            }}
          >
            Vérifiez un nom ou un pseudo WeWard
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}