import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { isSpeaking, onSpeakingChange, speak, stopSpeaking } from '../../platform/speech';

/** 🔊 toggle: reads `text` aloud, or stops reading if it is already speaking. */
export function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(isSpeaking());
  useEffect(() => onSpeakingChange(setOn), []);
  return (
    <button type="button" class={on ? 'runner__speak runner__speak--on' : 'runner__speak'}
      aria-label={t(on ? 'session.stopReading' : 'session.readAloud')} aria-pressed={on}
      onClick={() => (on ? stopSpeaking() : speak(text))}>
      {on ? '■' : '🔊'}
    </button>
  );
}
