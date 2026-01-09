import React from "react";
import { ImageResponse } from "next/og";

type GetResult = ImageResponse;

const GET = (): GetResult => {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
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
        },
      },
      "N"
    ),
    { width: 180, height: 180 }
  );
};

export { GET };
