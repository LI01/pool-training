import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export interface SheetProps {
  title?: string;
  onClose?: () => void;
  children: ComponentChildren;
}

/** Bottom-sheet modal. Tapping the backdrop calls onClose. */
export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
