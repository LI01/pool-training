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
