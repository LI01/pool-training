import { useState } from 'preact/hooks';
import type { RecordKind, RecordMode } from '../../plan';
import type { BlockResult } from '../../db/types';
import { t, toLen } from '../../i18n';
import { validateEntry, type EntryInput } from '../../runner/session';
import { BigButton } from './BigButton';
import { Sheet } from './Sheet';

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
      <button type="button" aria-label={t('entry.decrease', { label })} onClick={() => onChange(String(Math.max(0, n - 1)))}>−</button>
      <input
        class="stepper__value" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={label} value={value}
        onFocus={(e) => e.currentTarget.select()}
        onInput={(e) => onChange(e.currentTarget.value.replace(/\D/g, ''))}
      />
      <button type="button" aria-label={t('entry.increase', { label })} onClick={() => onChange(String(n + 1))}>+</button>
    </div>
  );
}

function initialRaw(kind: EntrySheetProps['kind'], r?: BlockResult): Record<string, string> {
  switch (kind) {
    case 'draw': return { bestIn: r?.draw ? String(toLen(r.draw.bestIn)) : '', typicalIn: r?.draw ? String(toLen(r.draw.typicalIn)) : '' };
    case 'runs': return { success: String(r?.runs?.success ?? 0), attempts: String(r?.runs?.attempts ?? 0) };
    case 'generic': return { made: String(r?.generic?.made ?? 0), attempts: String(r?.generic?.attempts ?? 0) };
    case 'notes': return { notes: r?.notes ?? '' };
  }
}

/** Quick-entry bottom sheet shown on Next for blocks that record something. */
export function EntrySheet({ kind, record, title, initial, onSubmit, onSkip, onClose }: EntrySheetProps) {
  const [raw, setRaw] = useState(() => initialRaw(kind, initial));
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setRaw((r) => ({ ...r, [k]: v }));

  const save = () => {
    const v = validateEntry(kind, raw);
    if (!v.ok) { setError(v.error); return; }
    onSubmit(v.entry);
  };

  return (
    <Sheet title={title ?? t('entry.record')} onClose={onClose}>
      {title && <h3 class="entry__title">{title}</h3>}
      <div class="entry">
        {kind === 'draw' && (
          <>
            <label class="field">
              <span>{t('entry.bestDraw')}</span>
              <input inputMode="decimal" value={raw.bestIn} onInput={(e) => set('bestIn', e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{t('entry.typicalDraw')}</span>
              <input inputMode="decimal" value={raw.typicalIn} onInput={(e) => set('typicalIn', e.currentTarget.value)} />
            </label>
          </>
        )}
        {kind === 'runs' && (
          <>
            <Stepper label={t('entry.successfulRuns')} value={raw.success} onChange={(v) => set('success', v)} />
            <Stepper label={t('entry.layouts')} value={raw.attempts} onChange={(v) => set('attempts', v)} />
          </>
        )}
        {kind === 'generic' && (
          <>
            <Stepper label={t('entry.made')} value={raw.made} onChange={(v) => set('made', v)} />
            <Stepper label={t('entry.attempts')} value={raw.attempts} onChange={(v) => set('attempts', v)} />
          </>
        )}
        {kind === 'notes' && (
          <label class="field">
            <span>{t('entry.notes')}</span>
            <textarea rows={4} value={raw.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
          </label>
        )}
        {error && <p class="notice notice--error" role="alert">{error}</p>}
      </div>
      <div class="sheet__actions sheet__actions--row">
        {(record === 'optional' || record === 'yes') && <BigButton onClick={onSkip}>{t('common.skip')}</BigButton>}
        <BigButton variant="good" onClick={save}>{t('common.save')}</BigButton>
      </div>
    </Sheet>
  );
}
