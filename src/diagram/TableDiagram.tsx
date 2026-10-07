import { useState } from 'preact/hooks';
import { DiagramViewer } from './DiagramViewer';
import { getDiagram } from './diagrams';
import { TableDiagram } from './TableSvg';
import './diagram.css';

export { TableDiagram } from './TableSvg';
export { railOffsets } from './measure';

/** Inline cards are ~3.6 px per inch on a 360px phone; scale labels up so they stay ≥10px. */
const INLINE_TEXT_SCALE = 1.7;

/** Inline diagram + caption shown at the top of drill/test screens; tap to open full screen. */
export function DiagramCard({ diagramId, panel }: { diagramId: string; panel?: number }) {
  const diagram = getDiagram(diagramId);
  const [open, setOpen] = useState(false);
  return (
    <figure class="diagram-card">
      <button type="button" class="diagram-card__open" aria-label="Open diagram" onClick={() => setOpen(true)}>
        <TableDiagram diagram={diagram} panel={panel} textScale={INLINE_TEXT_SCALE} />
      </button>
      <figcaption>{diagram.caption}</figcaption>
      {open && <DiagramViewer diagram={diagram} onClose={() => setOpen(false)} />}
    </figure>
  );
}
