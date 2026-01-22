import { ImageResponse } from "next/og";
export const dynamic = 'force-static';

type IconResult = ImageResponse;

const Icon = (): IconResult => {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#ffffff",
          fontSize: 220,
          fontWeight: 700,
          borderRadius: 96,
        }}
      >
        N
      </div>
    ),
    { width: 512, height: 512 }
  );
};

export default Icon;
