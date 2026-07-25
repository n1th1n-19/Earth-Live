"use client";

import { Bookmark as BookmarkIcon, Trash2 } from "lucide-react";
import { useUiStore } from "@/lib/store";

// FR-19/20/21: anonymous bookmarks via local storage (Zustand persist),
// syncable to the `bookmarks` table once auth ships (docs/06-database-design.md).
// Open state lives in the store (not local useState) so the `B` shortcut
// (docs/04-ui-ux-spec.md §4.6) can toggle it from page.tsx.
export function BookmarksPanel() {
  const bookmarks = useUiStore((s) => s.bookmarks);
  const removeBookmark = useUiStore((s) => s.removeBookmark);
  const requestFlyTo = useUiStore((s) => s.requestFlyTo);
  const open = useUiStore((s) => s.bookmarksPanelOpen);
  const setOpen = useUiStore((s) => s.setBookmarksPanelOpen);

  if (bookmarks.length === 0 && !open) return null;

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <BookmarkIcon size={14} />
        Bookmarks ({bookmarks.length})
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-2xl border border-white/10 bg-black/50 p-2 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          {bookmarks.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-neutral-500">No bookmarks yet</div>
          )}
          {bookmarks.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <button
                onClick={() => requestFlyTo(b.latitude, b.longitude)}
                className="truncate text-left text-xs text-neutral-200 hover:text-white"
              >
                {b.label}
              </button>
              <button onClick={() => removeBookmark(b.id)} className="text-neutral-500 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
