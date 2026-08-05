"use client";

import { useEffect, useState } from "react";
import { useSatelliteGroup } from "@/lib/use-satellites";
import { propagateTle, type PropagatedPosition } from "@/lib/satellite-propagation";
import { icons } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";

export function useIssData(): PropagatedPosition | null {
  const { data: stations } = useSatelliteGroup("stations");
  const [position, setPosition] = useState<PropagatedPosition | null>(null);
  const iss = stations?.find((s) => s.name.includes("ISS"));

  useEffect(() => {
    if (!iss) return;
    function update() {
      if (!iss) return;
      const propagated = propagateTle(iss.tleLine1, iss.tleLine2, new Date());
      if (propagated) setPosition(propagated);
    }
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [iss]);

  return position;
}

export function draw(args: DrawArgs, data: PropagatedPosition | null) {
  if (!data) return;
  if (!args.isFrontFacing(data.longitude, data.latitude)) return;
  const p = args.projection([data.longitude, data.latitude]);
  if (!p) return;
  icons.satellite(args.ctx, p[0], p[1], 7 * args.scaleFactor, "#ffffff");
  args.ctx.font = "12px monospace";
  args.ctx.fillStyle = "#fff";
  args.ctx.textAlign = "center";
  args.ctx.fillText("ISS", p[0], p[1] - 14);
}

export function getHitCandidates(args: DrawArgs, data: PropagatedPosition | null): HitCandidate[] {
  if (!data) return [];
  if (!args.isFrontFacing(data.longitude, data.latitude)) return [];
  const p = args.projection([data.longitude, data.latitude]);
  if (!p) return [];
  return [{ screenX: p[0], screenY: p[1], screenRadius: 10, label: "International Space Station" }];
}
