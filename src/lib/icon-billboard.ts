// Shared across every point-marker layer (earthquakes/flights/ISS/wildfires)
// so each icon is only ever rendered once per app session, not once per
// entity. Rendered in a neutral white stroke — per-entity severity/type
// color comes from Cesium's own BillboardGraphics `color` tint at render
// time, the same role PointGraphics' `color` prop played before, so this
// cache is keyed by icon name only, never by color.
//
// Raw SVG path data copied directly from lucide-react's icon modules
// (node_modules/lucide-react/dist/esm/icons/{plane,satellite,flame,
// activity}.mjs), not rendered via react-dom/server's renderToStaticMarkup
// — that's a server-rendering API, and using it client-side corrupted this
// exact chunk's bundling (Cesium's own WASM ended up mis-embedded as a
// template literal, throwing "Octal escape sequences are not allowed in
// template strings" at parse time — confirmed via `node --check` on the
// built chunk). Hand-building the SVG string sidesteps that entirely and is
// simpler for 4 static, never-changing icons anyway.
export type IconName = "plane" | "satellite" | "flame" | "activity";

const ICON_PATHS: Record<IconName, string[]> = {
  plane: [
    "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  ],
  satellite: [
    "m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5",
    "M16.5 7.5 19 5",
    "m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5",
    "M9 21a6 6 0 0 0-6-6",
    "M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z",
  ],
  flame: [
    "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4",
  ],
  activity: [
    "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
  ],
};

const cache = new Map<IconName, string>();

export function getIconDataUri(icon: IconName): string {
  const cached = cache.get(icon);
  if (cached) return cached;

  const paths = ICON_PATHS[icon].map((d) => `<path d="${d}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(icon, dataUri);
  return dataUri;
}
