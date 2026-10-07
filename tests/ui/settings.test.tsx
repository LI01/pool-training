import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
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
