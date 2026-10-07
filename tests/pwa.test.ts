import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

test('production build emits manifest and service worker under /pool-training/', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  expect(existsSync('dist/sw.js')).toBe(true);
  const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  expect(m.start_url).toBe('/pool-training/');
  expect(m.scope).toBe('/pool-training/');
  expect(m.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: 'icons/icon-512.png', purpose: 'any' }),
    expect.objectContaining({ src: 'icons/icon-maskable-512.png', purpose: 'maskable' }),
  ]));
  for (const i of m.icons) expect(existsSync(`dist/${i.src}`)).toBe(true);
  expect(existsSync('dist/icons/apple-touch-icon.png')).toBe(true);
  expect(readFileSync('dist/sw.js', 'utf8')).toMatch(/["']?url["']?\s*:\s*["']index\.html["']/);
  expect(readFileSync('dist/index.html', 'utf8')).toContain('/pool-training/assets/');
}, 120000);
