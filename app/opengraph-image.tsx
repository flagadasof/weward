import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Wardy BIP";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const imageUrl = new URL(
    "/wardy-fbi.png",
    "https://weward-gules.vercel.app",
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
        }}
      >
        <img
          src={imageUrl.toString()}
          alt="Wardy BIP"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}