import { Cartesian3 } from "cesium";

// Lat/long grid lines for the wireframe globe look — real computed
// geometry, not a texture. Meridians are sampled every ~2° of latitude
// (not just endpoints) so they render as smooth curves over the globe's
// curvature rather than a straight chord.
export function buildGraticulePositions(stepDeg = 15): Cartesian3[][] {
  const lines: Cartesian3[][] = [];

  for (let lon = -180; lon <= 180; lon += stepDeg) {
    const points: number[] = [];
    for (let lat = -90; lat <= 90; lat += 2) points.push(lon, lat);
    lines.push(Cartesian3.fromDegreesArray(points));
  }

  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const points: number[] = [];
    for (let lon = -180; lon <= 180; lon += 2) points.push(lon, lat);
    lines.push(Cartesian3.fromDegreesArray(points));
  }

  return lines;
}
