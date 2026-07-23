import * as satellite from "satellite.js";

// SGP4 propagation from cached CelesTrak TLEs — the documented production
// path for live satellite/ISS motion (docs/05-api-integration-guide.md §5.4),
// preferred over re-polling Open Notify every few seconds.
export interface PropagatedPosition {
  latitude: number;
  longitude: number;
  heightKm: number;
}

export function propagateTle(
  tleLine1: string,
  tleLine2: string,
  date: Date,
): PropagatedPosition | null {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const result = satellite.propagate(satrec, date);
  if (!result || !result.position || typeof result.position === "boolean") return null;

  const gmst = satellite.gstime(date);
  const geodetic = satellite.eciToGeodetic(result.position, gmst);

  return {
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: satellite.degreesLong(geodetic.longitude),
    heightKm: geodetic.height,
  };
}
