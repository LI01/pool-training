// Prints every spoken script as JSON for scripts/make_voice.py: [{ id, lang, key, text }].
import { setLang, type Lang } from '../src/i18n';
import { plan, TEST_ORDER, getTestDef } from '../src/plan';
import { blockScript, forSpeech, lessonScript, testScript, type Script } from '../src/platform/scripts';

// setLang also sets <html lang>; give it a stand-in document outside the browser.
(globalThis as { document?: unknown }).document ??= { documentElement: {} };

const out: { id: string; lang: Lang; key: string; text: string }[] = [];
for (const lang of ['en', 'zh'] as Lang[]) {
  setLang(lang);
  const scripts: Script[] = [
    ...plan.blocks.map(blockScript),
    ...TEST_ORDER.map((id) => testScript(getTestDef(id))),
    ...[...plan.blocks, ...TEST_ORDER.map(getTestDef)]
      .flatMap((x) => x.lesson.map((_, i) => lessonScript(x, i))),
  ];
  for (const s of scripts) out.push({ id: `${lang}:${s.key}`, lang, key: s.key, text: forSpeech(s.text, lang) });
}
console.log(JSON.stringify(out));
