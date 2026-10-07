import { getLang, t } from '../i18n';
import type { Block, TestDef } from '../plan';

let autoOn = true;
let speaking = false;
let current: SpeechSynthesisUtterance | null = null;
const listeners = new Set<(on: boolean) => void>();

const synth = (): SpeechSynthesis | undefined => (typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis);

function setSpeaking(on: boolean): void {
  speaking = on;
  listeners.forEach((l) => l(on));
}

/** Whether a block/test reads itself aloud when it starts (the Settings "Voice guidance" switch). */
export function setAutoSpeak(on: boolean): void {
  autoOn = on;
}
export const autoSpeak = (): boolean => autoOn;

export const isSpeaking = (): boolean => speaking;
/** Calls `l` whenever speaking starts or stops; returns the unsubscribe function. */
export function onSpeakingChange(l: (on: boolean) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Makes plan text read naturally: CB/OB, inch marks, number ranges and arrows. */
export function forSpeech(s: string, lang: 'en' | 'zh'): string {
  const out = s
    .replace(/(\d)\s*[–-]\s*(\d)/g, lang === 'zh' ? '$1到$2' : '$1 to $2')
    .replace(/(\d+(?:\.\d+)?)\s*"/g, lang === 'zh' ? '$1英寸' : '$1 inches')
    .replace(/(\d)\s*ft\b/g, lang === 'zh' ? '$1英尺' : '$1 feet')
    .replace(/\s*→\s*/g, lang === 'zh' ? '，然后' : ', then ');
  return lang === 'zh' ? out : out.replace(/\bCB\b/g, 'cue ball').replace(/\bOB\b/g, 'object ball');
}

const join = (parts: string[]) => {
  const zh = getLang() === 'zh';
  return parts.map((p) => p.trim().replace(/[.。]$/, '')).filter(Boolean).join(zh ? '。' : '. ') + (zh ? '。' : '.');
};
const labelled = (label: string, text: string) => `${label}${getLang() === 'zh' ? '：' : ': '}${text}`;

/** The spoken introduction of a training block: name, length, setup, how to train, success standard. */
export const blockScript = (b: Block): string => join([
  b.name, t('session.minutes', { n: b.minutes }),
  labelled(t('session.setup'), b.setup), labelled(t('session.howToTrain'), b.howToTrain),
  labelled(t('session.successStandard'), b.successStandard),
]);

/** The spoken introduction of a test: name and setup. */
export const testScript = (d: TestDef): string => join([d.name, d.setup]);

/** Reads `text` aloud in the app language, replacing anything already being read. No-op without speech support. */
export function speak(text: string): void {
  const s = synth();
  if (!s) return;
  try {
    // iOS Safari can drop an utterance queued right after an idle cancel(), so cancel only when busy.
    if (s.speaking || s.pending) s.cancel();
    const lang = getLang();
    const u = new SpeechSynthesisUtterance(forSpeech(text, lang));
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    const voices = s.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'zh' ? 'zh-cn' : 'en'));
    const voice = voices.find((v) => v.localService) ?? voices[0];
    if (voice) u.voice = voice;
    // A cancelled utterance reports end/error later; only the current one may change the state.
    u.onend = u.onerror = () => { if (current === u) { current = null; setSpeaking(false); } };
    current = u;
    setSpeaking(true);
    s.speak(u);
  } catch {
    setSpeaking(false);
  }
}

/** Reads `text` only when automatic voice guidance is on. */
export function speakAuto(text: string): void {
  if (autoOn) speak(text);
}

export function stopSpeaking(): void {
  current = null;
  try { synth()?.cancel(); } catch { /* ignore */ }
  setSpeaking(false);
}
