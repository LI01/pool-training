import { render, screen, fireEvent } from '@testing-library/preact';
import { TableDiagram, DiagramCard, railOffsets } from '../../src/diagram/TableDiagram';
import { DIAGRAMS } from '../../src/diagram/diagrams';

test.each(Object.keys(DIAGRAMS))('renders %s with separate table and overlay layers', (id) => {
  const { container } = render(<TableDiagram diagram={DIAGRAMS[id]} />);
  expect(container.querySelector('[data-layer="table"]')).not.toBeNull();
  expect(container.querySelector('[data-layer="overlay"]')).not.toBeNull();
});

test('card shows caption and opens full-screen viewer on tap', () => {
  render(<DiagramCard diagramId="am-draw-ladder" />);
  expect(screen.getByText(/Level cue, low contact/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /open diagram/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('5-ball test viewer shows rail measurements', () => {
  render(<DiagramCard diagramId="test-5ball" />);
  fireEvent.click(screen.getByRole('button', { name: /open diagram/i }));
  expect(screen.getAllByText(/from (left|right|top|bottom)/i).length).toBeGreaterThan(0);
});

test('railOffsets measures to the nearest short and long rail', () => {
  expect(railOffsets({ x: 16, y: 30 })).toEqual({ x: '16" from left', y: '9" from bottom' });
  expect(railOffsets({ x: 60, y: 10 })).toEqual({ x: '18" from right', y: '10" from top' });
});

test.each(Object.keys(DIAGRAMS))('%s overlay renders without the table layer (all overlay url(#…) refs resolve)', (id) => {
  const { container } = render(<TableDiagram diagram={DIAGRAMS[id]} measure />);
  for (const svg of Array.from(container.querySelectorAll('svg'))) {
    svg.querySelector('[data-layer="table"]')!.remove(); // e.g. replaced by a photo of the real table
    const overlay = svg.querySelector('[data-layer="overlay"]')!;
    const refs = Array.from(overlay.querySelectorAll('*')).flatMap((el) =>
      Array.from(el.attributes).flatMap((a) => Array.from(a.value.matchAll(/url\(#([^)]+)\)/g), (m) => m[1])));
    for (const ref of refs) expect(svg.querySelector(`[id="${ref}"]`)).not.toBeNull();
  }
});

test('viewer focuses Close on open and returns focus to the card on close', () => {
  render(<DiagramCard diagramId="test-stop" />);
  const open = screen.getByRole('button', { name: /open diagram/i });
  open.focus();
  fireEvent.click(open);
  const close = screen.getByRole('button', { name: 'Close' });
  expect(close).toHaveFocus();
  fireEvent.click(close);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(open).toHaveFocus();
});
