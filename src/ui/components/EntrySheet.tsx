import { useState } from 'preact/hooks';
import type { ErrorCodeId, RecordKind, RecordMode } from '../../plan';
import type { BlockResult } from '../../db/types';
import { validateEntry, type EntryInput } from '../../runner/session';
import { BigButton } from './BigButton';
import { Sheet } from './Sheet';
import { TagPicker } from './TagPicker';

export interface EntrySheetProps {
  kind: Exclude<RecordKind, null>;
  /** The block's record mode; Skip is offered for `optional` and `yes`. */
  record: RecordMode;
  title?: string;
  /** Previous result for this block (revisiting via Back) used to pre-fill. */
  initial?: BlockResult;
  onSubmit: (entry: EntryInput) => void;
  onSkip: () => void;
  onClose?: () => void;
}

/** − / typed number / + ; the raw text is kept so the field can be cleared while typing. */
function Stepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = Number(value) || 0;
  return (
    <div class="stepper">
      <span class="stepper__label">{label}</span>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(String(Math.max(0, n - 1)))}>−</button>
      <input
        class="stepper__value" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={label} value={value}
        onFocus={(e) => e.currentTarget.select()}
        onInput={(e) => onChange(e.currentTarget.value.replace(/\D/g, ''))}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(String(n + 1))}>+</button>
    </div>
  );
}

function initialRaw(kind: EntrySheetProps['kind'], r?: BlockResult): Record<string, string> {
  switch (kind) {
    case 'draw': return { bestIn: r?.draw ? String(r.draw.bestIn) : '', typicalIn: r?.draw ? String(r.draw.typicalIn) : '' };
    case 'runs': return { success: String(r?.runs?.success ?? 0), attempts: String(r?.runs?.attempts ?? 0) };
    case 'generic': return { made: String(r?.generic?.made ?? 0), attempts: String(r?.generic?.attempts ?? 0) };
    case 'notes': return { notes: r?.notes ?? '' };
  }
}

/** Quick-entry bottom sheet shown on Next for blocks that record something. */
export function EntrySheet({ kind, record, title, initial, onSubmit, onSkip, onClose }: EntrySheetProps) {
  const [raw, setRaw] = useState(() => initialRaw(kind, initial));
  const [tags, setTags] = useState<ErrorCodeId[]>(initial?.runs?.failTags ?? []);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setRaw((r) => ({ ...r, [k]: v }));
  const int = (k: string) => Number(raw[k]) || 0;
  const tagsFull = tags.length >= int('attempts') - int('success');

  const save = () => {
    const v = validateEntry(kind, kind === 'runs' ? { ...raw, failTags: tags.join(',') } : raw);
    if (!v.ok) { setError(v.error); return; }
    onSubmit(v.entry);
  };

  return (
    <Sheet title={title ?? 'Record'} onClose={onClose}>
      {title && <h3 class="entry__title">{title}</h3>}
      <div class="entry">
        {kind === 'draw' && (
          <>
            <label class="field">
              <span>Best draw (in)</span>
              <input inputMode="decimal" value={raw.bestIn} onInput={(e) => set('bestIn', e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>Typical draw (in)</span>
              <input inputMode="decimal" value={raw.typicalIn} onInput={(e) => set('typicalIn', e.currentTarget.value)} />
            </label>
          </>
        )}
        {kind === 'runs' && (
          <>
            <Stepper label="Successful runs" value={raw.success} onChange={(v) => set('success', v)} />
            <Stepper label="Layouts attempted" value={raw.attempts} onChange={(v) => set('attempts', v)} />
            <p class="entry__hint">Failed runs — tap a tag for each (optional)</p>
            <TagPicker noTag={false} disabled={tagsFull} onPick={(t) => t && !tagsFull && setTags((ts) => [...ts, t])} />
            {tags.length > 0 && (
              <div class="chips">
                {tags.map((t, i) => (
                  <button type="button" key={i} class="chip" aria-label={`Remove ${t}`} onClick={() => setTags((ts) => ts.filter((_, j) => j !== i))}>
                    {t} ×
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {kind === 'generic' && (
          <>
            <Stepper label="Made" value={raw.made} onChange={(v) => set('made', v)} />
            <Stepper label="Attempts" value={raw.attempts} onChange={(v) => set('attempts', v)} />
          </>
        )}
        {kind === 'notes' && (
          <label class="field">
            <span>Notes</span>
            <textarea rows={4} value={raw.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
          </label>
        )}
        {error && <p class="notice notice--error" role="alert">{error}</p>}
      </div>
      <div class="sheet__actions sheet__actions--row">
        {(record === 'optional' || record === 'yes') && <BigButton onClick={onSkip}>Skip</BigButton>}
        <BigButton variant="good" onClick={save}>Save</BigButton>
      </div>
    </Sheet>
  );
}
