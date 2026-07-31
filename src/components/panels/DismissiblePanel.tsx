"use client";

import { X } from "lucide-react";
import { useUiStore, type PanelId } from "@/lib/store";

// Wraps a local-conditions card with a close button, so the three cards can
// be dismissed individually instead of only as a group via the Weather layer
// toggle.
//
// The button is overlaid rather than added inside each card: all three share
// the same shell markup, so this keeps one copy of the control instead of
// three. Cards it covers reserve room for it with their own right padding.
//
// Returns null once dismissed, which also unmounts the wrapped card — so its
// polling hooks stop fetching rather than continuing to update something
// nobody can see.
export function DismissiblePanel({
  id,
  label,
  children,
}: {
  id: PanelId;
  label: string;
  children: React.ReactNode;
}) {
  const dismissed = useUiStore((s) => s.dismissedPanels.includes(id));
  const dismissPanel = useUiStore((s) => s.dismissPanel);

  if (dismissed) return null;

  return (
    <div className="pointer-events-none relative shrink-0">
      {children}
      <button
        onClick={() => dismissPanel(id)}
        aria-label={`Close ${label}`}
        title={`Close ${label}`}
        className="pointer-events-auto absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/10 hover:text-neutral-100 focus-visible:bg-white/10 focus-visible:text-neutral-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}
