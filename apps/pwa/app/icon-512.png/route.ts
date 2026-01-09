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
          fontSize: 220,
          fontWeight: 700,
          borderRadius: 96,
        },
      },
      "N"
    ),
    { width: 512, height: 512 }
  );
};

export { GET };
