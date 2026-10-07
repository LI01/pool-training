import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { isSpeaking, onSpeakingChange, speak, stopSpeaking, type Script } from '../../platform/speech';

/** 🔊 toggle: reads `script` aloud, or stops reading if it is already speaking. */
export function ReadAloud({ script }: { script: Script }) {
  const [on, setOn] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setOn), []);
  return (
    <button type="button" class={on ? 'runner__speak runner__speak--on' : 'runner__speak'}
      aria-label={t(on ? 'session.stopReading' : 'session.readAloud')} aria-pressed={on}
      onClick={() => (on ? stopSpeaking() : speak(script))}>
      {on ? '■' : '🔊'}
    </button>
  );
}
