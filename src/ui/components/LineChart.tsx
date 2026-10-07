import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { mountChart } from './chartSetup';

export interface LineSeries { label: string; data: (number | null)[]; color: string }

export function LineChart({ labels, series, yMax, stepSize, title }: { labels: string[]; series: LineSeries[]; yMax?: number; stepSize?: number; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify([labels, series, yMax, stepSize]);
  useEffect(() => {
    if (!ref.current) return;
    const chart = mountChart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color,
          pointRadius: 3, borderWidth: 2, tension: 0.2, spanGaps: true,
        })),
      },
      options: { scales: { y: { min: 0, ...(yMax !== undefined ? { max: yMax } : {}), beginAtZero: true, ...(stepSize ? { ticks: { stepSize, maxTicksLimit: 11 } } : {}) } } },
    });
    return () => chart?.destroy();
  }, [key]);
  return (
    <figure class="chart">
      {title && <h3>{title}</h3>}
      <canvas ref={ref} role="img" aria-label={title ?? t('chart.line')} />
    </figure>
  );
}
