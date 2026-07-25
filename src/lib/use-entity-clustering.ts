"use client";

import { useMemo } from "react";
import { EntityCluster } from "cesium";

// Point layers (earthquakes/flights/wildfires) render as flat Resium
// <Entity> lists. Cesium's built-in clustering only groups entities that
// live in a DataSource's EntityCollection, not the Viewer's default one, so
// callers wrap their <Entity> list in <CustomDataSource clustering={...}>
// using the cluster config this returns.
export function useEntityClustering(minimumClusterSize = 4): EntityCluster {
  return useMemo(
    () => new EntityCluster({ enabled: true, pixelRange: 60, minimumClusterSize }),
    [minimumClusterSize],
  );
}
