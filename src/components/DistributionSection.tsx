import { useMemo, useState } from 'react';
import { bandOf, PRICE_BANDS } from '../lib/data';
import { pct, quarterLabel } from '../lib/format';
import { axisStyle, baseOption } from '../lib/theme';
import { Chart } from './Chart';
import type { Ctx } from './ctx';
import { Section, Segmented } from './ui';

type View = 'compare' | 'mix';

export function DistributionSection({ ctx }: { ctx: Ctx }) {
  const [view, setView] = useState<View>('compare');
  const { data, qi, palette: p, area } = ctx;

  const counts = (i: number) => {
    const c = PRICE_BANDS.map(() => 0);
    for (const s of area) { const m = s.median[i]; if (m != null) c[bandOf(m)]++; }
    return c;
  };

  const option = useMemo(() => {
    const ax = axisStyle(p);
    if (view === 'compare') {
      const then = Math.max(0, qi - 20);
      const now = counts(qi), past = counts(then);
      return {
        ...baseOption(p),
        grid: { left: 40, right: 8, top: 40, bottom: 28 },
        legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: p.ink2 } },
        tooltip: { ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } } },
        xAxis: { type: 'category', data: PRICE_BANDS.map((b) => b.label), ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 0, fontSize: 10 } },
        yAxis: { type: 'value', ...ax, axisLine: { show: false } },
        series: [
          { name: quarterLabel(data.quarters[then]), type: 'bar', data: past, itemStyle: { color: p.series[1], borderRadius: [4, 4, 0, 0] }, barGap: '8%' },
          { name: quarterLabel(data.quarters[qi]), type: 'bar', data: now, itemStyle: { color: p.series[0], borderRadius: [4, 4, 0, 0] } },
        ],
      };
    }
    // Share of suburbs in each band, same quarter-of-year across all years.
    const idx = data.quarters.map((_, i) => i).filter((i) => i % 4 === qi % 4 && i <= qi);
    const shares = idx.map((i) => { const c = counts(i); const t = c.reduce((a, b) => a + b, 0) || 1; return c.map((v) => v / t); });
    return {
      ...baseOption(p),
      grid: { left: 40, right: 8, top: 56, bottom: 28 },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: p.ink2, fontSize: 11 } },
      tooltip: { ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } }, valueFormatter: (v: number) => pct(v, 0, false) },
      xAxis: { type: 'category', data: idx.map((i) => data.quarters[i].slice(0, 4)), ...ax, splitLine: { show: false } },
      yAxis: { type: 'value', max: 1, ...ax, axisLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: (v: number) => pct(v, 0, false) } },
      series: PRICE_BANDS.map((b, k) => ({
        name: b.label, type: 'bar', stack: 'share', barCategoryGap: '22%',
        data: shares.map((s) => s[k]),
        itemStyle: { color: p.ordinal[k], borderColor: p.surface, borderWidth: 1 },
      })),
    };
  }, [view, qi, area, p, data]);

  return (
    <Section
      title="Where suburb prices sit"
      subtitle={view === 'compare'
        ? <>Number of suburbs in each median-price band in {quarterLabel(data.quarters[qi])}, against five years earlier.</>
        : <>Share of suburbs in each price band, Q{(qi % 4) + 1} of every year. Darker = pricier.</>}
      actions={<Segmented label="Distribution view" value={view} onChange={setView} options={[{ value: 'compare', label: 'vs 5 yrs ago' }, { value: 'mix', label: 'Mix over time' }]} />}
    >
      <Chart option={option} height={380} ariaLabel="Distribution of suburb median prices by price band" />
    </Section>
  );
}
