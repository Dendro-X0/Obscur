import type { MetadataRoute } from "next";

type ManifestResult = MetadataRoute.Manifest;

const getManifest = (): ManifestResult => {
  return {
    name: "Obscur",
    short_name: "Obscur",
    description: "Secure, encrypted messaging on the Nostr protocol with NIP-04 encryption",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
};

export default getManifest;
