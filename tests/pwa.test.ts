import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

test('production build emits manifest and service worker under /pool-training/', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  expect(existsSync('dist/sw.js')).toBe(true);
  const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  expect(m.start_url).toBe('/pool-training/');
  expect(readFileSync('dist/index.html', 'utf8')).toContain('/pool-training/assets/');
}, 120000);
