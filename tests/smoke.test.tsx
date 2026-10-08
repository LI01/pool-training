import { render, screen, waitFor } from '@testing-library/preact';
import { App } from '../src/ui/App';
import { createStore } from '../src/db/store';

test('app renders Today', async () => {
  location.hash = '#/';
  render(<App store={createStore('smoke')} />);
  await waitFor(() => expect(screen.getByText('Day 1 of 48')).toBeInTheDocument());
});
