import { getMoonIllumination } from "suncalc";

// Client-side, zero-API-call moon phase — the documented free alternative
// where no unlimited free moon-phase API exists (docs/05-api-integration-guide.md §5.8).
export interface MoonInfo {
  phaseName: string;
  illuminationPercent: number;
}

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

export function getMoonInfo(date: Date): MoonInfo {
  const { fraction, phase } = getMoonIllumination(date);
  const index = Math.round(phase * 8) % 8;
  return {
    phaseName: PHASE_NAMES[index],
    illuminationPercent: Math.round(fraction * 100),
  };
}
