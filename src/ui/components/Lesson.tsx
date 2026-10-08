import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { LessonFigure } from '../../lesson/figures';
import type { Block, TestDef } from '../../plan';
import { isSpeaking, lessonScript, onSpeakingChange, speak, stopSpeaking } from '../../platform/speech';

/** Inline "Key points": the step titles, each opening the illustrated walkthrough, and a button that plays it all. */
export function LessonCard({ item }: { item: Block | TestDef }) {
  const [open, setOpen] = useState<{ step: number; play: boolean } | null>(null);
  return (
    <section class="lesson-card">
      <div class="lesson-card__head">
        <h3>{t('lesson.title')}</h3>
        <button type="button" class="runner__speak-btn" onClick={() => setOpen({ step: 0, play: true })}>
          <span aria-hidden="true">💡</span> {t('lesson.listen')}
        </button>
      </div>
      <ol>
        {item.lesson.map((s, i) => (
          <li key={s.title}><button type="button" class="lesson-card__step" onClick={() => setOpen({ step: i, play: false })}>{s.title}</button></li>
        ))}
      </ol>
      {open && <LessonViewer item={item} start={open.step} autoplay={open.play} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Full-screen walkthrough: one figure and key point per page; while playing, each finished step turns the page. */
export function LessonViewer({ item, start, autoplay, onClose }: { item: Block | TestDef; start: number; autoplay: boolean; onClose: () => void }) {
  const steps = item.lesson;
  const [i, setI] = useState(start);
  const [playing, setPlaying] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const play = (n: number) => {
    setI(n);
    speak(lessonScript(item, n), () => { if (n + 1 < steps.length) play(n + 1); });
  };
  const go = (n: number) => { if (isSpeaking()) play(n); else setI(n); };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const off = onSpeakingChange(setPlaying);
    if (autoplay) play(start);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
      stopSpeaking();
      opener?.focus?.();
    };
  }, []);

  const step = steps[i];
  return (
    <div class="lesson" role="dialog" aria-modal="true" aria-labelledby="lesson-title">
      <header class="lesson__header">
        <h2 id="lesson-title">{t('lesson.title')} · {item.name}</h2>
        <button type="button" class="lesson__close" ref={closeRef} onClick={onClose}>{t('diagram.close')}</button>
      </header>
      <div class="lesson__body">
        <div class="lesson__figure"><LessonFigure id={step.figure} /></div>
        <p class="lesson__count">{t('lesson.step', { i: i + 1, n: steps.length })}</p>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
      </div>
      <footer class="lesson__controls">
        <button type="button" aria-label={t('lesson.prev')} disabled={i === 0} onClick={() => go(i - 1)}>‹</button>
        {playing
          ? <button type="button" class="lesson__play" onClick={stopSpeaking}>■ {t('session.stopReading')}</button>
          : <button type="button" class="lesson__play" onClick={() => play(i)}>▶ {t('lesson.play')}</button>}
        <button type="button" aria-label={t('lesson.next')} disabled={i === steps.length - 1} onClick={() => go(i + 1)}>›</button>
      </footer>
    </div>
  );
}
