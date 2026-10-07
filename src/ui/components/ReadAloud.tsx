import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { isSpeaking, onSpeakingChange, speak, stopSpeaking, type Script } from '../../platform/speech';

/** Repeat reads `script` aloud from the start (even mid-reading); Stop shows while something is being read. */
export function ReadAloud({ script }: { script: Script }) {
  const [on, setOn] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setOn), []);
  return (
    <span class="runner__speak">
      {on && (
        <button type="button" class="runner__speak-btn" aria-label={t('session.stopReading')} onClick={stopSpeaking}>■</button>
      )}
      <button type="button" class={on ? 'runner__speak-btn runner__speak-btn--on' : 'runner__speak-btn'} onClick={() => speak(script)}>
        <span aria-hidden="true">↻</span> {t('session.repeat')}
      </button>
    </span>
  );
}
