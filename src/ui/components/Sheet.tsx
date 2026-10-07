import type { ComponentChildren } from 'preact';

export interface SheetProps {
  title?: string;
  onClose?: () => void;
  children: ComponentChildren;
}

/** Bottom-sheet modal. Tapping the backdrop calls onClose. */
export function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
