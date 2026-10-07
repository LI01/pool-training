import { blockScript, forSpeech, isSpeaking, setAutoSpeak, speak, speakAuto, stopSpeaking, testScript } from '../../src/platform/speech';
import { setLang } from '../../src/i18n';
import { getBlock, getTestDef } from '../../src/plan';

class Utterance {
  lang = ''; voice: unknown = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => [] as { lang: string; localService: boolean }[]) };

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', synth);
  synth.speaking = false;
  setAutoSpeak(true);
  stopSpeaking();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

const spoken = () => synth.speak.mock.calls.at(-1)![0] as Utterance;

test('forSpeech makes plan shorthand readable', () => {
  expect(forSpeech('CB-to-OB: 8", 16" · 30–40 shots · CB 1 ft → 2 ft', 'en'))
    .toBe('cue ball-to-object ball: 8 inches, 16 inches · 30 to 40 shots · cue ball 1 feet, then 2 feet');
  expect(forSpeech('距离 12" · 30–40 杆 · 1 ft → 2', 'zh')).toBe('距离 12英寸 · 30到40 杆 · 1英尺，然后2');
});

test('block script reads name, length, setup, how to train and success standard, not volume or purpose', () => {
  const b = getBlock('am-draw-ladder')!;
  const s = blockScript(b);
  expect(s).toContain('Draw ladder');
  expect(s).toContain('16 min');
  expect(s).toContain(`Setup: ${b.setup.replace(/\.$/, '')}`);
  expect(s).toContain('How to Train');
  expect(s).toContain('Success Standard');
  expect(s).not.toContain(b.volume);
  expect(s).not.toContain(b.purpose);
});

test('scripts follow the app language', () => {
  setLang('zh');
  expect(blockScript(getBlock('am-draw-ladder')!)).toMatch(/^低杆阶梯练习。16 分钟。摆放：/);
  expect(testScript(getTestDef('cut'))).toMatch(/^切球。/);
});

test('speak uses the app language and a matching local voice', () => {
  synth.getVoices.mockReturnValue([{ lang: 'en-US', localService: true }, { lang: 'zh-CN', localService: false }, { lang: 'zh_CN', localService: true }]);
  setLang('zh');
  speak('你好');
  expect(spoken().lang).toBe('zh-CN');
  expect(spoken().voice).toEqual({ lang: 'zh_CN', localService: true });
  expect(isSpeaking()).toBe(true);
});

test('cancels only when busy, and a cancelled utterance ending late does not clear the new one', () => {
  speak('one');
  expect(synth.cancel).not.toHaveBeenCalled();
  const first = spoken();
  synth.speaking = true;
  speak('two');
  expect(synth.cancel).toHaveBeenCalledTimes(1);
  first.onend!();
  expect(isSpeaking()).toBe(true);
  spoken().onend!();
  expect(isSpeaking()).toBe(false);
});

test('speakAuto respects the voice guidance switch', () => {
  setAutoSpeak(false);
  speakAuto('x');
  expect(synth.speak).not.toHaveBeenCalled();
  setAutoSpeak(true);
  speakAuto('x');
  expect(synth.speak).toHaveBeenCalledTimes(1);
});

test('no speech support is a no-op', () => {
  vi.stubGlobal('speechSynthesis', undefined);
  expect(() => { speak('x'); stopSpeaking(); }).not.toThrow();
  expect(isSpeaking()).toBe(false);
});
