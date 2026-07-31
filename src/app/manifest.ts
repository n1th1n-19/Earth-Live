import type { MetadataRoute } from "next";

// Emitted by Next at /manifest.webmanifest, with the <link rel="manifest">
// tag generated automatically.
//
// This replaces public/logo/site.webmanifest, which came from a favicon
// generator and couldn't work as shipped: it had an empty name/short_name,
// and its icon paths ("/android-chrome-192x192.png") pointed at the site
// root while the files actually live under /logo/.
//
// The colours are black rather than that file's #ffffff: an installed PWA
// uses background_color for its splash screen, so white would flash before
// a globe that is almost entirely black.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Earth Live",
    short_name: "Earth Live",
    description: "Real-time flights, earthquakes, wildfires and weather on a live 3D globe.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/logo/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
