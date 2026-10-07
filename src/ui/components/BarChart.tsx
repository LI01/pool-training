import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { mountChart } from './chartSetup';

export interface BarSeries { label: string; data: number[]; color: string }

export function BarChart({ labels, series, stacked, title }: { labels: string[]; series: BarSeries[]; stacked?: boolean; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify([labels, series, stacked]);
  useEffect(() => {
    if (!ref.current) return;
    const chart = mountChart(ref.current, {
      type: 'bar',
      data: { labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color })) },
      options: { scales: { x: { stacked: !!stacked }, y: { stacked: !!stacked, beginAtZero: true } } },
    });
    return () => chart?.destroy();
  }, [key]);
  return (
    <figure class="chart">
      {title && <h3>{title}</h3>}
      <canvas ref={ref} role="img" aria-label={title ?? t('chart.bar')} />
    </figure>
  );
}
