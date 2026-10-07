import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

test('import of an invalid file shows an error and keeps data', async () => {
  const store = createStore('ui-settings-1');
  await store.putSession({ id: 's', date: '2026-10-07', sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 60, blocks: [] });
  location.hash = '#/settings';
  render(<App store={store} now={() => Date.now()} />);
  const input = await screen.findByLabelText(/import backup/i);
  const file = new File(['{"app":"nope"}'], 'bad.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not a pool-training backup|invalid/i));
  expect(await store.listSessions()).toHaveLength(1);
});

let n = 0;
const NOW = new Date(2026, 9, 9, 8, 0).getTime();
const goodBackup = {
  app: 'pool-training', schema: 1, exportedAt: 5,
  sessions: [{ id: 'x', date: '2026-10-01', sessionId: 'pm', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 5, blocks: [] }],
  tests: [], settings: { soundOn: true },
};
const pick = (input: HTMLElement, text: string) =>
  fireEvent.change(input, { target: { files: [new File([text], 'f.json', { type: 'application/json' })] } });

test('not-JSON import shows error', async () => {
  location.hash = '#/settings';
  render(<App store={createStore(`set-${++n}`)} now={() => NOW} />);
  pick(await screen.findByLabelText(/import backup/i), 'nope{');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid file: not JSON'));
});

test('valid import: confirm replaces data and shows success', async () => {
  const store = createStore(`set-${++n}`);
  await store.putSession({ id: 'old', date: '2026-10-02', sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 1, blocks: [] });
  location.hash = '#/settings';
  render(<App store={store} now={() => NOW} />);
  pick(await screen.findByLabelText(/import backup/i), JSON.stringify(goodBackup));
  const dlg = await screen.findByRole('dialog');
  expect(dlg).toHaveTextContent('Replace all current data with this backup (1 sessions, 0 tests)?');
  fireEvent.click(within(dlg).getByText('Replace'));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Backup imported.'));
  expect((await store.listSessions()).map((s) => s.id)).toEqual(['x']);
});

test('import failure from the store shows an alert, no success message', async () => {
  const store = createStore(`set-${++n}`);
  store.importBackup = async () => { throw new Error('quota'); };
  location.hash = '#/settings';
  render(<App store={store} now={() => NOW} />);
  pick(await screen.findByLabelText(/import backup/i), JSON.stringify(goodBackup));
  fireEvent.click(within(await screen.findByRole('dialog')).getByText('Replace'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Import failed: quota'));
  expect(screen.queryByRole('status')).toBeNull();
});

test('export updates lastExportAt and triggers a download', async () => {
  const store = createStore(`set-${++n}`);
  const create = vi.fn(() => 'blob:x');
  (URL as any).createObjectURL = create;
  (URL as any).revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  location.hash = '#/settings';
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText('Export backup'));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Backup downloaded.'));
  expect(create).toHaveBeenCalled();
  expect(click).toHaveBeenCalled();
  expect((await store.getSettings()).lastExportAt).toBe(NOW);
  expect(screen.getByText(/Last backup: 2026-10-09/)).toBeInTheDocument();
  click.mockRestore();
});

test('reset needs two taps', async () => {
  const store = createStore(`set-${++n}`);
  await store.putSession({ id: 's', date: '2026-10-02', sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 1, blocks: [] });
  location.hash = '#/settings';
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText('Reset all data'));
  expect(await store.listSessions()).toHaveLength(1);
  fireEvent.click(screen.getByText('Tap again to confirm'));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All data erased.'));
  expect(await store.listSessions()).toHaveLength(0);
});
