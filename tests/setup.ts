import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom has no canvas; return null (as browsers do for unsupported contexts) instead of logging "Not implemented".
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
// jsdom has no media playback either; voice clips "play" silently.
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};

// Tests assert English; a test that switches to Chinese must not leak it into the next one.
import { setLang } from '../src/i18n';
afterEach(() => setLang('en'));
