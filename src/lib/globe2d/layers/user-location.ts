"use client";

import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function draw(args: DrawArgs, data: UserLocation | null) {
  if (!data) return;
  const { ctx, projection, scaleFactor } = args;
  if (!args.isFrontFacing(data.longitude, data.latitude)) return;
  const projected = projection([data.longitude, data.latitude]);
  if (!projected) return;
  icons.pin(ctx, projected[0], projected[1] - 6 * scaleFactor, 8 * scaleFactor, "#4da3ff");
}

export function getHitCandidates(args: DrawArgs, data: UserLocation | null): HitCandidate[] {
  if (!data) return [];
  if (!args.isFrontFacing(data.longitude, data.latitude)) return [];
  const projected = args.projection([data.longitude, data.latitude]);
  if (!projected) return [];
  return [
    {
      screenX: projected[0],
      screenY: projected[1],
      screenRadius: 10,
      label: "Your location",
    },
  ];
}
