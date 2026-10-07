import { blockScript, clipUrl, forSpeech, isSpeaking, setAutoSpeak, speak, speakAuto, stopSpeaking, testScript } from '../../src/platform/speech';
import { setLang, type Lang } from '../../src/i18n';
import { getBlock, getTestDef, plan, TEST_ORDER } from '../../src/plan';

class Utterance {
  lang = ''; voice: unknown = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => [] as { lang: string; localService: boolean }[]) };
let playResult: Promise<void> = Promise.resolve();
const audios: FakeAudio[] = [];
class FakeAudio {
  src = ''; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  play = vi.fn(() => playResult);
  pause = vi.fn();
  constructor() { audios.push(this); }
}

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('Audio', FakeAudio);
  synth.speaking = false;
  playResult = Promise.resolve();
  setAutoSpeak(true);
  stopSpeaking();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

const spoken = () => synth.speak.mock.calls.at(-1)![0] as Utterance;
const plain = (text: string) => ({ key: 'none', text });   // no recorded clip → device voice
const audio = () => audios.at(-1)!;

test('forSpeech makes plan shorthand readable', () => {
  expect(forSpeech('CB-to-OB: 8", 16" · 30–40 shots · CB 1 ft → 2 ft · 16 min', 'en'))
    .toBe('cue ball-to-object ball: 8 inches, 16 inches · 30 to 40 shots · cue ball 1 feet, then 2 feet · 16 minutes');
  expect(forSpeech('距离 12" · 30–40 杆 · 1 ft → 2', 'zh')).toBe('距离 12英寸 · 30到40 杆 · 1英尺，然后2');
});

test('block and test scripts say the hand-written speech, not the plan fields', () => {
  const b = getBlock('am-draw-ladder')!;
  expect(blockScript(b)).toEqual({ key: 'block:am-draw-ladder', text: b.speech });
  expect(b.speech).not.toContain(b.setup);
  const d = getTestDef('cut');
  expect(testScript(d)).toEqual({ key: 'test:cut', text: d.speech });
});

test('scripts follow the app language', () => {
  setLang('zh');
  expect(blockScript(getBlock('am-draw-ladder')!).text).toMatch(/^现在练低杆/);
  expect(testScript(getTestDef('cut')).text).toMatch(/^下一项，切球/);
});

test.each(['en', 'zh'] as Lang[])('every block and test has an up-to-date recorded clip (%s) — rerun scripts/make_voice.py if not', (lang) => {
  setLang(lang);
  const scripts = [...plan.sessions.flatMap((s) => s.blocks.map(blockScript)), ...TEST_ORDER.map((id) => testScript(getTestDef(id)))];
  for (const s of scripts) expect(clipUrl(s), `${lang}:${s.key}`).toMatch(new RegExp(`${lang}-${s.key.replace(':', '-')}.*\\.mp3`));
});

test('a recorded script plays its clip, not the device voice; the clip ending clears speaking', () => {
  speak(blockScript(getBlock('am-draw-ladder')!));
  expect(audio().src).toMatch(/en-block-am-draw-ladder/);
  expect(audio().play).toHaveBeenCalled();
  expect(synth.speak).not.toHaveBeenCalled();
  expect(isSpeaking()).toBe(true);
  audio().onended!();
  expect(isSpeaking()).toBe(false);
});

test('a clip that no longer matches its text is not played', () => {
  const s = blockScript(getBlock('am-draw-ladder')!);
  expect(clipUrl({ ...s, text: `${s.text} Changed.` })).toBeUndefined();
});

test('a refused clip falls back to the device voice once; an earlier clip ending later changes nothing', async () => {
  playResult = Promise.reject(new Error('NotAllowedError'));
  speak(testScript(getTestDef('cut')));
  const a = audio();
  a.onerror!();
  await Promise.resolve(); await Promise.resolve();
  expect(synth.speak).toHaveBeenCalledTimes(1);
  expect(spoken().text).toMatch(/^Next, cut shots/);
  const staleEnded = a.onended!;
  playResult = Promise.resolve();
  speak(testScript(getTestDef('stop')));
  staleEnded();
  expect(isSpeaking()).toBe(true);
});

test('stop pauses the clip', () => {
  speak(testScript(getTestDef('cut')));
  stopSpeaking();
  expect(audio().pause).toHaveBeenCalled();
  expect(isSpeaking()).toBe(false);
});

test('device voice: app language and a matching local voice', () => {
  synth.getVoices.mockReturnValue([{ lang: 'en-US', localService: true }, { lang: 'zh-CN', localService: false }, { lang: 'zh_CN', localService: true }]);
  setLang('zh');
  speak(plain('你好'));
  expect(spoken().lang).toBe('zh-CN');
  expect(spoken().voice).toEqual({ lang: 'zh_CN', localService: true });
  expect(isSpeaking()).toBe(true);
});

test('device voice: cancels only when busy, and a cancelled utterance ending late does not clear the new one', () => {
  speak(plain('one'));
  expect(synth.cancel).not.toHaveBeenCalled();
  const first = spoken();
  synth.speaking = true;
  speak(plain('two'));
  expect(synth.cancel).toHaveBeenCalled();
  first.onend!();
  expect(isSpeaking()).toBe(true);
  spoken().onend!();
  expect(isSpeaking()).toBe(false);
});

test('speakAuto respects the voice guidance switch', () => {
  setAutoSpeak(false);
  speakAuto(plain('x'));
  expect(synth.speak).not.toHaveBeenCalled();
  setAutoSpeak(true);
  speakAuto(plain('x'));
  expect(synth.speak).toHaveBeenCalledTimes(1);
});

test('no speech support is a no-op', () => {
  vi.stubGlobal('speechSynthesis', undefined);
  expect(() => { speak(plain('x')); stopSpeaking(); }).not.toThrow();
  expect(isSpeaking()).toBe(false);
});
