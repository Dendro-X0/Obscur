import { ImageResponse } from "next/og";

type AppleIconResult = ImageResponse;

const AppleIcon = (): AppleIconResult => {
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
          fontSize: 92,
          fontWeight: 700,
          borderRadius: 40,
        }}
      >
        N
      </div>
    ),
    { width: 180, height: 180 }
  );
};

export default AppleIcon;
