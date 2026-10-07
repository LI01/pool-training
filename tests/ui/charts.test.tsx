import { act } from 'preact/test-utils';
import { render } from '@testing-library/preact';
import { BarChart } from '../../src/ui/components/BarChart';
import { LineChart } from '../../src/ui/components/LineChart';

const destroy = vi.fn();
vi.mock('chart.js', async (orig) => {
  const m = await orig<typeof import('chart.js')>();
  class FakeChart { static register = m.Chart.register; destroy = destroy; }
  return { ...m, Chart: FakeChart };
});

const series = [{ label: 'a', data: [1, null, 3], color: '#fff' }];

test('charts render without a canvas context (jsdom) and do not crash', () => {
  const l = render(<LineChart title="L" labels={['a', 'b', 'c']} series={series} />);
  const b = render(<BarChart title="B" labels={['a']} series={[{ label: 'a', data: [1], color: '#fff' }]} stacked />);
  expect(l.getByText('L')).toBeInTheDocument();
  l.unmount(); b.unmount();
  expect(destroy).not.toHaveBeenCalled();
});

test('unmount destroys the chart when a canvas context exists', () => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  let unmount = () => {};
  act(() => { unmount = render(<LineChart labels={['a']} series={series} />).unmount; });
  act(() => {});
  act(() => unmount());
  expect(destroy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
