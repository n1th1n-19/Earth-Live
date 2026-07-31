"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { MapPin, Bookmark as BookmarkIcon, Layers, Search } from "lucide-react";
import { useUiStore, type LayerId } from "@/lib/store";
import { useGeocodeSearch } from "@/lib/use-geocode-search";

// docs/02-product-requirements.md FR-11/FR-28, docs/04-ui-ux-spec.md §4.4.
// Unifies global search + layer toggles + bookmarks + actions in one
// keyboard-first (Cmd/Ctrl+K) surface.
const LAYER_LABELS: Record<LayerId, string> = {
  weather: "Weather",
  earthquakes: "Earthquakes",
  wildfires: "Wildfires",
  disasters: "Disaster alerts",
  alerts: "US severe weather",
  flights: "Flights",
  iss: "ISS",
  places: "Capitals",
  volcanoes: "Volcanoes",
  airports: "Nearby airports",
};

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const requestFlyTo = useUiStore((s) => s.requestFlyTo);
  const bookmarks = useUiStore((s) => s.bookmarks);
  const activeLayers = useUiStore((s) => s.activeLayers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);

  const [query, setQuery] = useState("");
  const { data: places, isFetching } = useGeocodeSearch(query);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  function flyToAndClose(latitude: number, longitude: number) {
    requestFlyTo(latitude, longitude);
    setOpen(false);
    setQuery("");
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search"
      shouldFilter={false}
      className="fixed left-1/2 top-24 z-50 w-[90vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-black/80 text-neutral-100 shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Search size={16} className="text-neutral-500" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search places, bookmarks, layers…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-neutral-500">
          {isFetching ? "Searching…" : "No results"}
        </Command.Empty>

        {places && places.length > 0 && (
          <Command.Group heading="Places" className="px-2 py-1 text-xs uppercase tracking-wide text-neutral-500">
            {places.map((place) => (
              <Command.Item
                key={`${place.latitude}-${place.longitude}`}
                onSelect={() => flyToAndClose(place.latitude, place.longitude)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-white/10"
              >
                <MapPin size={14} className="shrink-0 text-neutral-400" />
                <span className="truncate">{place.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {bookmarks.length > 0 && (
          <Command.Group heading="Bookmarks" className="px-2 py-1 text-xs uppercase tracking-wide text-neutral-500">
            {bookmarks.map((b) => (
              <Command.Item
                key={b.id}
                onSelect={() => flyToAndClose(b.latitude, b.longitude)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-white/10"
              >
                <BookmarkIcon size={14} className="shrink-0 text-amber-400" />
                <span className="truncate">{b.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Layers" className="px-2 py-1 text-xs uppercase tracking-wide text-neutral-500">
          {(Object.keys(LAYER_LABELS) as LayerId[]).map((id) => (
            <Command.Item
              key={id}
              onSelect={() => toggleLayer(id)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-neutral-400" />
                {LAYER_LABELS[id]}
              </span>
              <span className={activeLayers.includes(id) ? "text-emerald-400" : "text-neutral-600"}>
                {activeLayers.includes(id) ? "On" : "Off"}
              </span>
            </Command.Item>
          ))}
        </Command.Group>

      </Command.List>
    </Command.Dialog>
  );
}
