import { useEffect, useRef, useState } from 'preact/hooks';
import { railOffsets } from './measure';
import { TableDiagram } from './TableSvg';
import type { Diagram } from './types';
import './diagram.css';

const isPortrait = () => window.innerHeight > window.innerWidth;
// Rotated portrait view: the table's left rail is at the top of the screen, its bottom rail on the left, etc.
const PORTRAIT_SIDE: Record<string, string> = { left: 'top', top: 'right', right: 'bottom', bottom: 'left' };

/** Full-screen diagram: rotates to portrait on upright phones, pinch/zoom, caption, optional rail measurements. */
export function DiagramViewer({ diagram, onClose }: { diagram: Diagram; onClose: () => void }) {
  const [portrait, setPortrait] = useState(isPortrait);
  const [zoom, setZoom] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount-only: callers usually pass a fresh onClose each render, which must not re-run focus handling.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onResize = () => setPortrait(isPortrait());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const balls = diagram.showMeasurements
    ? diagram.panels.flat().flatMap((el) => (el.t === 'ball' && el.kind === 'object' ? [el] : []))
    : [];
  const titleId = `dv-title-${diagram.id}`;

  return (
    <div class="diagram-viewer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header class="diagram-viewer__header">
        <h2 id={titleId}>{diagram.title}</h2>
        <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>−</button>
        <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>+</button>
        <button type="button" class="diagram-viewer__close" ref={closeRef} onClick={onClose}>Close</button>
      </header>
      <div class="diagram-viewer__body">
        <div class="diagram-viewer__stage" style={{ width: `${zoom * 100}%` }}>
          <TableDiagram diagram={diagram} rotate={portrait} measure={!!diagram.showMeasurements} />
        </div>
        <footer class="diagram-viewer__footer">
          <p>{diagram.caption}</p>
          {balls.length > 0 && (
            <ul class="diagram-viewer__measure">
              {balls.map((b, i) => {
                const o = railOffsets(b.at);
                const side = (t: string) => (portrait ? t.replace(/left|top|right|bottom/, (m) => PORTRAIT_SIDE[m]) : t);
                return <li key={i}>Ball {b.num ?? i + 1}: {side(o.x)}, {side(o.y)}</li>;
              })}
            </ul>
          )}
        </footer>
      </div>
    </div>
  );
}
