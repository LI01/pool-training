import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom has no canvas; return null (as browsers do for unsupported contexts) instead of logging "Not implemented".
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
