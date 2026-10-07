import type { ErrorCodeId } from '../../plan';
import { t } from '../../i18n';

export const TAGS: ErrorCodeId[] = ['P', 'C', 'S', 'D'];

/** P/C/S/D error tag buttons (accessible names "P Potting" …) plus an optional "No tag". */
export function TagPicker({ onPick, noTag = true, disabled = false }: { onPick: (t: ErrorCodeId | null) => void; noTag?: boolean; disabled?: boolean }) {
  return (
    <div class="tag-picker">
      {TAGS.map((code) => (
        <button type="button" key={code} class="tag-picker__tag" disabled={disabled} onClick={() => onPick(code)}>
          <span class="tag-picker__code">{code}</span> <span>{t(`tag.${code}`)}</span>
        </button>
      ))}
      {noTag && <button type="button" class="tag-picker__none" onClick={() => onPick(null)}>{t('tag.none')}</button>}
    </div>
  );
}
