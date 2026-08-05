"use client";

import { useDisasters } from "@/lib/use-disasters";
import { gdacsIcon } from "@/lib/globe2d/icons";
import type { DrawArgs, HitCandidate } from "@/lib/globe2d/types";
import type { Disaster } from "@/lib/adapters/gdacs";

const ALERT_COLOR: Record<Disaster["alertLevel"], string> = {
  Red: "#ff3b30",
  Orange: "#ff9f0a",
};
const LABEL_MIN_SCALE_FACTOR = 1.5;

export function useDisastersData() {
  return useDisasters().data;
}

function toSelectedEvent(disaster: Disaster) {
  const attributes = [
    { label: "Type", value: disaster.typeLabel },
    { label: "Alert level", value: disaster.alertLevel },
  ];
  if (disaster.country) attributes.push({ label: "Country", value: disaster.country });
  if (disaster.severityText) attributes.push({ label: "Severity", value: disaster.severityText });
  if (disaster.fromDate) {
    attributes.push({ label: "Since", value: new Date(disaster.fromDate).toLocaleDateString() });
  }
  return {
    kind: "disaster" as const,
    title: disaster.title,
    attributes,
    latitude: disaster.latitude,
    longitude: disaster.longitude,
  };
}

export function draw(args: DrawArgs, data: Disaster[] | undefined) {
  if (!data) return;
  const { ctx, projection, scaleFactor } = args;
  const showLabels = scaleFactor > LABEL_MIN_SCALE_FACTOR;

  for (const disaster of data) {
    if (!args.isFrontFacing(disaster.longitude, disaster.latitude)) continue;
    const p = projection([disaster.longitude, disaster.latitude]);
    if (!p) continue;
    const color = ALERT_COLOR[disaster.alertLevel];
    const size = (disaster.alertLevel === "Red" ? 6 : 4.5) * scaleFactor;
    gdacsIcon(disaster.type)(ctx, p[0], p[1], size, color);
    if (showLabels) {
      ctx.font = "11px monospace";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(disaster.typeLabel, p[0], p[1] - size - 4);
    }
  }
}

export function getHitCandidates(args: DrawArgs, data: Disaster[] | undefined): HitCandidate[] {
  if (!data) return [];
  const out: HitCandidate[] = [];
  for (const disaster of data) {
    if (!args.isFrontFacing(disaster.longitude, disaster.latitude)) continue;
    const p = args.projection([disaster.longitude, disaster.latitude]);
    if (!p) continue;
    out.push({
      screenX: p[0],
      screenY: p[1],
      screenRadius: 9,
      label: `${disaster.typeLabel} · ${disaster.alertLevel} alert`,
      detail: disaster.country ? `${disaster.title} — ${disaster.country}` : disaster.title,
      toSelectedEvent: () => toSelectedEvent(disaster),
    });
  }
  return out;
}
