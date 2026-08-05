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
    { items: T[]; sumX: number; sumY: number; sumLng: number; sumLat: number }
  >();

  for (const point of points) {
    const projected = project(point.lng, point.lat);
    if (!projected) continue;
    const key = `${Math.floor(projected[0] / cellPx)},${Math.floor(projected[1] / cellPx)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { items: [], sumX: 0, sumY: 0, sumLng: 0, sumLat: 0 };
      cells.set(key, cell);
    }
    cell.items.push(point.item);
    cell.sumX += projected[0];
    cell.sumY += projected[1];
    cell.sumLng += point.lng;
    cell.sumLat += point.lat;
  }

  return Array.from(cells.values()).map((cell) => {
    const n = cell.items.length;
    return {
      screenX: cell.sumX / n,
      screenY: cell.sumY / n,
      lng: cell.sumLng / n,
      lat: cell.sumLat / n,
      items: cell.items,
    };
  });
}
