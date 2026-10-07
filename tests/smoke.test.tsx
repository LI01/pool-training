import { render, screen } from '@testing-library/preact';
import { App } from '../src/ui/App';

test('app renders title', () => {
  render(<App />);
  expect(screen.getByText('Pool Training')).toBeInTheDocument();
});
