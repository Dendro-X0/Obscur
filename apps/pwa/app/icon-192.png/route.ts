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
          background: "#050505",
        },
      },
      React.createElement(
        "svg",
        { width: 192, height: 192, viewBox: "0 0 256 256", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
        React.createElement("rect", { x: 24, y: 24, width: 208, height: 208, rx: 52, fill: "#050505" }),
        React.createElement("path", {
          d: "M84 128c0-33.137 26.863-60 60-60 12.71 0 24.496 3.955 34.2 10.7",
          stroke: "rgba(255,255,255,0.86)",
          strokeWidth: 18,
          strokeLinecap: "round",
        }),
        React.createElement("path", {
          d: "M172 128c0 33.137-26.863 60-60 60-12.71 0-24.496-3.955-34.2-10.7",
          stroke: "rgba(255,255,255,0.78)",
          strokeWidth: 18,
          strokeLinecap: "round",
        }),
        React.createElement("circle", { cx: 178, cy: 78, r: 8, fill: "rgba(255,255,255,0.9)" })
      )
    ),
    { width: 192, height: 192 }
  );
};

export { GET };
