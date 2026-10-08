import { render, cleanup } from '@testing-library/preact';
import { setLang, type Lang } from '../../src/i18n';
import { FIGURE_IDS, LessonFigure } from '../../src/lesson/figures';

afterEach(() => { cleanup(); setLang('en'); });

test.each(['en', 'zh'] as Lang[])('every lesson figure draws, with its labels in the app language (%s)', (lang) => {
  setLang(lang);
  for (const id of FIGURE_IDS) {
    const { container, unmount } = render(<LessonFigure id={id} />);
    const svg = container.querySelector('svg');
    expect(svg, id).not.toBeNull();
    const words = [...container.querySelectorAll('text')].map((n) => n.textContent ?? '').join(' ');
    if (lang === 'zh' && words.trim()) expect(words, id).toMatch(/[一-鿿]|°|✗|✓|^[\d\s]+$/);
    unmount();
  }
});

test('table close-ups are cropped to the part of the table they show', () => {
  const { container } = render(<LessonFigure id="ghost-ball" />);
  const [, , w] = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
  expect(w).toBeLessThan(60);
});
