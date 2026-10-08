import { getLang } from '../i18n';
import manifest from '../voice/manifest.json';
import { forSpeech, type Script } from './scripts';

export { blockScript, forSpeech, testScript, tipsScript, type Script } from './scripts';

/** Pre-recorded neural-voice clips (scripts/make_voice.py), keyed by `<lang>:<script key>`. */
const MANIFEST: Record<string, { file: string; text: string }> = manifest;
const CLIP_URLS = import.meta.glob<string>('../voice/*.mp3', { query: '?url', import: 'default', eager: true });

let autoOn = true;
let speaking = false;
let current: SpeechSynthesisUtterance | null = null;
let audio: HTMLAudioElement | null = null;
/** Bumped on every speak/stop, so events from an earlier clip never change the state. */
let gen = 0;
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

/** The clip URL for `script` in the current language, only if it was recorded from exactly this text. */
export function clipUrl(script: Script): string | undefined {
  const lang = getLang();
  const clip = MANIFEST[`${lang}:${script.key}`];
  if (!clip || clip.text !== forSpeech(script.text, lang)) return undefined;
  return CLIP_URLS[`../voice/${clip.file}`];
}

function speakSynth(text: string): void {
  const s = synth();
  if (!s) { setSpeaking(false); return; }
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

/** One reused element: iOS lets it play again once a tap has started it. */
function player(): HTMLAudioElement | null {
  if (!audio && typeof Audio !== 'undefined') audio = new Audio();
  return audio;
}

/**
 * Reads `script` aloud in the app language, replacing anything already being read: the recorded clip when one
 * matches the text, otherwise the device's speech synthesis. Call from a tap so iOS allows playback.
 */
export function speak(script: Script): void {
  stopSpeaking();
  const url = clipUrl(script);
  const a = url ? player() : null;
  if (!url || !a) { speakSynth(script.text); return; }
  const g = gen;
  a.onended = () => { if (g === gen) setSpeaking(false); };
  // Clip failed (load error or playback refused): fall back to the device voice, once.
  const fallback = () => { if (g === gen) { gen++; speakSynth(script.text); } };
  a.onerror = fallback;
  setSpeaking(true);
  try {
    a.src = url;
    // Older engines return undefined instead of a promise.
    a.play()?.catch(fallback);
  } catch {
    fallback();
  }
}

/** Reads `script` only when automatic voice guidance is on. */
export function speakAuto(script: Script): void {
  if (autoOn) speak(script);
}

export function stopSpeaking(): void {
  gen++;
  current = null;
  try { audio?.pause(); } catch { /* ignore */ }
  try { const s = synth(); if (s && (s.speaking || s.pending)) s.cancel(); } catch { /* ignore */ }
  setSpeaking(false);
}
