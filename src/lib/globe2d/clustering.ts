// Screen-space grid clustering — Cesium's EntityCluster has no 2D-canvas
// equivalent, so points are bucketed by rounded screen position instead.
// Recomputed every render since screen position moves with rotation/zoom.
export interface ClusterInput<T> {
  lng: number;
  lat: number;
  item: T;
}

export interface Cluster<T> {
  screenX: number;
  screenY: number;
  lng: number;
  lat: number;
  items: T[];
}

export function clusterPoints<T>(
  points: ClusterInput<T>[],
  project: (lng: number, lat: number) => [number, number] | null,
  cellPx: number,
): Cluster<T>[] {
  const cells = new Map<
    string,
    { items: T[]; sumX: number; sumY: number; sumSinLng: number; sumCosLng: number; sumLat: number }
  >();

  for (const point of points) {
    const projected = project(point.lng, point.lat);
    if (!projected) continue;
    const key = `${Math.floor(projected[0] / cellPx)},${Math.floor(projected[1] / cellPx)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { items: [], sumX: 0, sumY: 0, sumSinLng: 0, sumCosLng: 0, sumLat: 0 };
      cells.set(key, cell);
    }
    cell.items.push(point.item);
    cell.sumX += projected[0];
    cell.sumY += projected[1];
    // Circular mean, not a plain average — a cell straddling the antimeridian
    // (e.g. points at -179° and 179°) would otherwise average to 0° instead
    // of ±180°, putting the cluster centroid (and its flyTo target) on the
    // opposite side of the globe.
    const lngRad = (point.lng * Math.PI) / 180;
    cell.sumSinLng += Math.sin(lngRad);
    cell.sumCosLng += Math.cos(lngRad);
    cell.sumLat += point.lat;
  }

  return Array.from(cells.values()).map((cell) => {
    const n = cell.items.length;
    return {
      screenX: cell.sumX / n,
      screenY: cell.sumY / n,
      lng: (Math.atan2(cell.sumSinLng, cell.sumCosLng) * 180) / Math.PI,
      lat: cell.sumLat / n,
      items: cell.items,
    };
  });
}
