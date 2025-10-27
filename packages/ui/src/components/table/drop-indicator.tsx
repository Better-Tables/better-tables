'use client';

/**
 * Generic drop indicator component for drag-and-drop lists.
 *
 * Displays a visual horizontal line indicator to show where a dragged
 * item will be dropped. Used between sortable items in lists.
 *
 * @example
 * ```tsx
 * <DropIndicator isOver={isOver} />
 * ```
 */
export function DropIndicator({ isOver }: { isOver: boolean }) {
  if (!isOver) {
    return null;
  }

  return (
    <div
      className="pointer-events-none relative h-0.5 w-full rounded-full bg-primary shadow-sm transition-all duration-200 ease-out"
      role="presentation"
      aria-hidden="true"
    >
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-sm" />
    </div>
  );
}
