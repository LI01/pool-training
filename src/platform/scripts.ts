import type { Block, TestDef } from '../plan';

/** A spoken introduction: `key` names its pre-recorded clip (per language), `text` is what it says. */
export interface Script { key: string; text: string }

/** Makes plan text read naturally: CB/OB, inch marks, number ranges and arrows. */
export function forSpeech(s: string, lang: 'en' | 'zh'): string {
  const out = s
    .replace(/(\d)\s*[–-]\s*(\d)/g, lang === 'zh' ? '$1到$2' : '$1 to $2')
    .replace(/(\d+(?:\.\d+)?)\s*"/g, lang === 'zh' ? '$1英寸' : '$1 inches')
    .replace(/(\d)\s*ft\b/g, lang === 'zh' ? '$1英尺' : '$1 feet')
    .replace(/(\d)\s*min\b/g, lang === 'zh' ? '$1分钟' : '$1 minutes')
    .replace(/\s*→\s*/g, lang === 'zh' ? '，然后' : ', then ');
  return lang === 'zh' ? out : out.replace(/\bCB\b/g, 'cue ball').replace(/\bOB\b/g, 'object ball');
}

/** The spoken introduction of a training block. */
export const blockScript = (b: Block): Script => ({ key: `block:${b.id}`, text: b.speech });

/** The spoken introduction of a test. */
export const testScript = (d: TestDef): Script => ({ key: `test:${d.id}`, text: d.speech });
