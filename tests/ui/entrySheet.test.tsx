import { render, screen, fireEvent } from '@testing-library/preact';
import { EntrySheet } from '../../src/ui/components/EntrySheet';

test('steppers accept a typed number; +/− still work', () => {
  const onSubmit = vi.fn();
  render(<EntrySheet kind="generic" record="yes" onSubmit={onSubmit} onSkip={() => {}} />);
  const attempts = screen.getByLabelText('Attempts') as HTMLInputElement;
  expect(attempts).toHaveAttribute('inputmode', 'numeric');
  fireEvent.input(attempts, { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Increase Attempts' }));
  expect(attempts).toHaveValue('31');
  fireEvent.input(screen.getByLabelText('Made'), { target: { value: '2x2' } }); // non-digits dropped
  expect(screen.getByLabelText('Made')).toHaveValue('22');
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Made' }));
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSubmit).toHaveBeenCalledWith({ generic: { made: 21, attempts: 31 } });
});

test('runs: only successes and layouts are asked, no failure reasons', () => {
  const onSubmit = vi.fn();
  render(<EntrySheet kind="runs" record="yes" onSubmit={onSubmit} onSkip={() => {}} />);
  fireEvent.input(screen.getByLabelText('Layouts attempted'), { target: { value: '3' } });
  fireEvent.input(screen.getByLabelText('Successful runs'), { target: { value: '1' } });
  expect(screen.queryByRole('button', { name: /Potting/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSubmit).toHaveBeenCalledWith({ runs: { success: 1, attempts: 3, failTags: [] } });
});
