import type { ErrorCodeId } from '../../plan';

export const TAGS: { code: ErrorCodeId; label: string }[] = [
  { code: 'P', label: 'Potting' },
  { code: 'C', label: 'Cue-ball' },
  { code: 'S', label: 'Spin/Speed' },
  { code: 'D', label: 'Decision' },
];

/** P/C/S/D error tag buttons (accessible names "P Potting" …) plus an optional "No tag". */
export function TagPicker({ onPick, noTag = true, disabled = false }: { onPick: (t: ErrorCodeId | null) => void; noTag?: boolean; disabled?: boolean }) {
  return (
    <div class="tag-picker">
      {TAGS.map(({ code, label }) => (
        <button type="button" key={code} class="tag-picker__tag" disabled={disabled} onClick={() => onPick(code)}>
          <span class="tag-picker__code">{code}</span> <span>{label}</span>
        </button>
      ))}
      {noTag && <button type="button" class="tag-picker__none" onClick={() => onPick(null)}>No tag</button>}
    </div>
  );
}
