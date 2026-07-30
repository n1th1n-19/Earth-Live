// Soft radial-gradient glow, used by earthquake/wildfire markers instead of
// a technical icon glyph — readable at a glance without knowing what a
// seismograph or a flame pictogram means, the same spirit as an aurora: a
// glowing patch of color, not a labeled symbol. One image, generated and
// cached once; per-entity severity color comes from Cesium's own
// BillboardGraphics `color` tint at render time (magnitude/brightness still
// drives real size and color, same as before — only the image changed).
let cached: string | null = null;

export function getGlowDataUri(): string {
  if (cached) return cached;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="35%" stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  </svg>`;
  cached = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return cached;
}
