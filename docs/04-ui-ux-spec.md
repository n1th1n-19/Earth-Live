# 4. UI/UX Design Specification

## 4.1 Design philosophy

Earth Live's interface takes cues from Apple (restraint, material honesty, motion with purpose), Linear (information density without clutter, keyboard-first power-user paths), FlightRadar24 and Windy (data-dense map overlays that stay legible), Arc Browser (playful but controlled use of color and glass surfaces), and Nothing OS (confident use of negative space and monospace/technical typography accents for data readouts). The globe is always the hero; every UI element is a floating layer that can be dismissed to return to an unobstructed Earth.

Design rule of thumb: **if a panel isn't currently answering a question the user asked, it should be collapsed or translucent, not gone** — global context (search, layers, coordinates) stays reachable in one tap/click at all times.

## 4.2 Visual language

- **Theme:** Dark mode is the default and the primary design target; a light theme is a first-class second target, not an inverted afterthought. Theme follows `prefers-color-scheme` on first visit, user-overridable and persisted.
- **Color:** A near-black (not pure #000, to avoid OLED smearing/halo on bright markers) base surface, with data-layer colors reserved exclusively for data (temperature gradients, AQI category colors, magnitude-scaled quake markers) — chrome (panels, buttons, text) stays neutral grayscale so data always reads as the "loud" element on screen.
- **Glass panels:** Floating panels (layer list, search, detail popups) use a translucent, blurred backdrop (`backdrop-filter: blur`) over the globe, with a subtle 1px border at ~10% white opacity to stay legible over any imagery beneath, in both themes.
- **Typography:** A geometric sans (e.g., Inter or system-ui stack) for UI text; a monospace face for all coordinate, timestamp, and numeric telemetry readouts (magnitude, altitude, speed) to reinforce the "instrument panel" feel and improve scannability of tabular data.
- **Iconography:** A single consistent icon set (Lucide) throughout — no mixing icon families, which is a common source of visual noise in data-dense apps.
- **Motion:** Framer Motion for all panel enter/exit, bottom-sheet drag, and command-palette transitions — spring-based, not fixed-duration easing, so motion feels physical rather than mechanical. Camera fly-to animations are Cesium's own eased flight path, tuned to ~1.5–2.5s depending on distance so they read as intentional "travel," not a jarring cut.

## 4.3 Layout system

- **Desktop (≥ 1280px):** Persistent collapsible left sidebar (layers, bookmarks, search), floating bottom-left coordinate readout, floating top-right command-palette trigger + account menu, detail panels slide in from the right as a docked panel (not modal — the globe stays interactive underneath).
- **Ultra-wide (≥ 2560px / 21:9+):** Layout does not simply stretch — side panels cap at a max-width (~420px) and remain left/right-docked, leaving the full vertical band of the globe unobstructed in the center; an optional secondary right-docked panel (e.g., stats dashboard) can open alongside the left panel without ever centering content in a way that wastes the ultra-wide canvas.
- **Tablet (768–1279px):** Sidebar collapses to an icon rail by default, expandable on tap; detail panels become a right-docked overlay at ~40% width.
- **Foldable:** Layout listens for `screen.orientation`/viewport aspect-ratio changes (foldables report this at the hinge) and re-flows the sidebar from docked to bottom-sheet if the usable width drops below the tablet breakpoint mid-session — no reload required (NFR-2).
- **Mobile (< 768px):** Bottom-sheet-first pattern for everything (layers, search results, event details) — sheets snap between peek/half/full states with a drag handle; the top bar collapses to a single search icon + avatar; layer toggles live in a full-screen sheet, not a cramped sidebar.
- **Touch targets:** Minimum 44×44px hit area on all interactive controls regardless of breakpoint (applies even on desktop for touch-screen laptops).

## 4.4 Core components

- **Command palette (`Cmd/Ctrl+K`):** Full-screen-on-mobile / centered-modal-on-desktop fuzzy search across places, bookmarks, layers, and actions, per FR-28. Recently used items shown when the query is empty.
- **Layer panel:** Categorized, collapsible groups (Weather, Environment, Geological, Space, Transportation, Marine, Reference) with a liveness badge and last-updated time per row (FR-15); a "reset to default layers" action; search-within-layers filter once the list exceeds ~15 items.
- **Bottom sheet:** Used for event detail, layer panel (mobile), and settings on small viewports; supports drag-to-dismiss and remembers its last snap state per sheet type within a session.
- **Floating controls:** Zoom +/-, compass/reset-north, current-location recenter, and fullscreen toggle cluster bottom-right on desktop, thumb-reachable bottom-right on mobile.
- **Detail panel:** Consistent header (event type icon + title + close), attribute table (monospace values), source attribution line, and action row (bookmark, share, copy coordinates) — this same template is reused for every event type (quake, fire, flight, ship, volcano, ISS, satellite) so users learn the pattern once.
- **Coordinate readout:** Always-visible, small, monospace, bottom-left; click cycles decimal ↔ DMS format.
- **API status panel:** A list of every upstream source with a colored liveness dot (green/amber/red) and last-successful-fetch time — accessible from the account/settings menu, not front-and-center, since it's a trust/debug surface rather than a primary feature.
- **Statistics dashboard:** A dedicated route/overlay with stat tiles (current global counts) and sparkline trends over the active replay window, using the shared charting library (see [07-tech-stack.md](07-tech-stack.md)).
- **Onboarding overlay:** A maximum of 3 sequential, skippable spotlight callouts on first visit (search, layers, command palette) — never a multi-step forced tour.

## 4.5 Accessibility (WCAG 2.1 AA)

- Full keyboard operability: every action reachable via mouse/touch has a keyboard path (Tab order follows visual hierarchy; command palette is the universal keyboard entry point per FR-28).
- Color is never the sole information channel: magnitude/AQI/severity scales pair color with a numeric value and, where feasible, an icon or pattern (e.g., quake markers scale in size with magnitude in addition to color).
- Minimum 4.5:1 text contrast against its immediate background at all times, including over glass panels (verified against the busiest expected imagery backdrop, not just a flat color swatch).
- All interactive elements have visible focus states distinct from hover states.
- Live regions (`aria-live`) announce layer data updates and error/offline badges to screen readers without requiring focus to be on that element.
- Motion respects `prefers-reduced-motion`: fly-to camera animation duration shortens and panel spring transitions become simple fades.
- Alt text / accessible names for every marker type and icon-only control.

## 4.6 Keyboard shortcuts (desktop)

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+K` | Open command palette |
| `/` | Focus search |
| `L` | Toggle layer panel |
| `B` | Toggle bookmarks panel |
| `F` | Toggle fullscreen |
| `R` | Toggle replay mode |
| `Esc` | Close active panel / exit replay / deselect event |
| `+ / -` | Zoom in/out |
| `Space` (in replay) | Play/pause |

## 4.7 Responsive breakpoint table

| Breakpoint | Range | Sidebar | Detail panel | Layer panel |
|---|---|---|---|---|
| Mobile | < 768px | Hidden (icon in top bar) | Bottom sheet | Bottom sheet |
| Tablet | 768–1279px | Icon rail (expandable) | Right overlay (~40%) | Right overlay |
| Desktop | 1280–2559px | Persistent, collapsible | Right-docked (~360px) | Left-docked |
| Ultra-wide | ≥ 2560px | Persistent, capped width | Right-docked (capped ~420px) | Left-docked, capped width |

## 4.8 Empty, loading, and error states

- **Loading:** Skeleton shimmer on panels (not full-screen spinners) so the globe and already-resolved layers remain interactive while others are still loading — consistent with progressive population described in FR-7.
- **Empty:** e.g., "No earthquakes ≥ M2.5 within 500 km in the last 24 hours" — stated positively as a real finding, not a generic "no data" message, since an empty result is itself meaningful live information.
- **Error:** Per-layer inline error (§2.4.9) with retry countdown; never a full-screen error unless the app shell itself fails to load.
