import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Legend, Tooltip, Filler);

const TICK = '#9fb3a9';
const GRID = 'rgba(255,255,255,0.06)';

/** Fixed colors per test/line series, used consistently across charts. */
export const SERIES_COLORS = { total: '#3fbf7f', left: '#5ab0ff', right: '#ff9f43', alt: '#f2c14e' } as const;

/** Creates a chart on the canvas; returns undefined where canvas is unavailable (jsdom). */
export function mountChart(canvas: HTMLCanvasElement, config: ChartConfiguration): Chart | undefined {
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return undefined;
  const base = (config.options ?? {}) as Record<string, unknown>;
  const scales = (base.scales ?? {}) as Record<string, Record<string, unknown>>;
  const styled = (s: Record<string, unknown> | undefined, grid: boolean) => ({
    ...s,
    ticks: { color: TICK, maxTicksLimit: 5, ...(s?.ticks as object) },
    grid: { color: GRID, display: grid },
  });
  return new Chart(ctx, {
    ...config,
    options: {
      ...base,
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.6,
      animation: false,
      plugins: { ...(base.plugins as object), legend: { position: 'bottom', labels: { color: TICK, boxWidth: 12 } } },
      scales: { x: styled({ ...scales.x, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } }, false), y: styled(scales.y, true) },
    },
  } as ChartConfiguration);
}
