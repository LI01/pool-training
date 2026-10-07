import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

test('switching language in Settings shows Today in Chinese, and back in English', async () => {
  const store = createStore('ui-lang-1');
  location.hash = '#/settings';
  render(<App store={store} now={() => Date.now()} />);

  fireEvent.click(await screen.findByRole('button', { name: '中文' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument());
  expect((await store.getSettings()).lang).toBe('zh');
  expect(document.documentElement.lang).toBe('zh-CN');

  fireEvent.click(screen.getByRole('button', { name: '今天' }));
  expect(await screen.findByText('第 1 天 / 共 30 天')).toBeInTheDocument();
  expect(screen.getByText('上午训练')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  fireEvent.click(await screen.findByRole('button', { name: 'English' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByText('Day 1 of 30')).toBeInTheDocument();
  expect(screen.getByText('Morning Session')).toBeInTheDocument();
});

test('a saved Chinese setting is applied on startup', async () => {
  const store = createStore('ui-lang-2');
  await store.saveSettings({ soundOn: true, lang: 'zh' });
  location.hash = '#/';
  render(<App store={store} now={() => Date.now()} />);
  expect(await screen.findByText('第 1 天 / 共 30 天')).toBeInTheDocument();
});
