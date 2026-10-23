import { useMemo, useState } from 'react';
import { areaTtm } from '../lib/data';
import { money, num, pct, quarterLabel } from '../lib/format';
import { axisStyle, baseOption } from '../lib/theme';
import { Chart } from './Chart';
import type { Ctx } from './ctx';
import { Section, Segmented } from './ui';

type Range = 'all' | '10' | '5';

export function TrendSection({ ctx }: { ctx: Ctx }) {
  const [range, setRange] = useState<Range>('all');
  const { data, qi, palette: p, areaSeries: series, metroSeries, council, areaName, area } = ctx;

  const { priceOpt, salesOpt } = useMemo(() => {
    const span = range === 'all' ? Infinity : Number(range) * 4;
    const start = Math.max(0, qi + 1 - span);
    const idx = data.quarters.map((_, i) => i).filter((i) => i >= start && i <= qi);
    const x = idx.map((i) => quarterLabel(data.quarters[i]));
    const ax = axisStyle(p);

    const lines: any[] = [
      {
        name: `${areaName} · quarterly`,
        type: 'line', data: idx.map((i) => series[i].price), showSymbol: false, symbolSize: 8,
        lineStyle: { width: 2, color: p.series[0] }, itemStyle: { color: p.series[0] },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: p.series[0] + '33' }, { offset: 1, color: p.series[0] + '00' }] } },
        endLabel: { show: true, formatter: (v: any) => money(v.value), color: p.ink, fontWeight: 600 },
      },
      {
        name: `${areaName} · 12-month`,
        type: 'line', data: idx.map((i) => areaTtm(area, i)?.price ?? null), showSymbol: false, symbolSize: 8,
        lineStyle: { width: 2, color: p.series[1] }, itemStyle: { color: p.series[1] },
      },
    ];
    if (council !== 'ALL') {
      lines.push({
        name: 'Metro Adelaide · quarterly',
        type: 'line', data: idx.map((i) => metroSeries[i].price), showSymbol: false, symbolSize: 8,
        lineStyle: { width: 2, color: p.series[2] }, itemStyle: { color: p.series[2] },
      });
    }

    const priceOpt = {
      ...baseOption(p),
      grid: { left: 64, right: 72, top: 44, bottom: 30 },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: p.ink2 } },
      tooltip: {
        ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: p.axis } },
        valueFormatter: (v: number) => money(v, false),
      },
      xAxis: { type: 'category', data: x, boundaryGap: false, ...ax, splitLine: { show: false },
        axisLabel: { ...ax.axisLabel, interval: (i: number) => idx[i] % 4 === 0, formatter: (v: string) => v.slice(3) } },
      yAxis: { type: 'value', ...ax, axisLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: (v: number) => money(v) }, scale: true },
      series: lines,
    };

    const salesOpt = {
      ...baseOption(p),
      grid: { left: 64, right: 72, top: 12, bottom: 30 },
      tooltip: {
        ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } },
        formatter: (ps: any[]) => {
          const i = idx[ps[0].dataIndex];
          const prev = i >= 4 ? series[i - 4].sales : null;
          return `<b>${ps[0].axisValue}</b><br/>${num(series[i].sales)} houses sold` +
            (prev ? `<br/><span style="color:${p.muted}">${pct(series[i].sales / prev - 1)} vs same qtr last year</span>` : '') +
            `<br/><span style="color:${p.muted}">${series[i].suburbs} suburbs with sales</span>`;
        },
      },
      xAxis: { type: 'category', data: x, ...ax, splitLine: { show: false },
        axisLabel: { ...ax.axisLabel, interval: (i: number) => idx[i] % 4 === 0, formatter: (v: string) => v.slice(3) } },
      yAxis: { type: 'value', ...ax, axisLine: { show: false }, splitNumber: 3, axisLabel: { ...ax.axisLabel, formatter: (v: number) => num(v) } },
      series: [{
        name: 'Houses sold', type: 'bar', data: idx.map((i) => series[i].sales), barCategoryGap: '25%',
        itemStyle: { color: p.series[0], borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: p.seq[5] } },
      }],
    };
    return { priceOpt, salesOpt };
  }, [range, qi, data, p, series, metroSeries, council, areaName, area]);

  return (
    <Section
      title="Price & volume over time"
      subtitle={<>Typical (sales-weighted) house price by quarter, with the smoother 12-month measure, and the number of houses sold. Hover for exact values.</>}
      actions={<Segmented label="Time range" value={range} onChange={setRange}
        options={[{ value: 'all', label: 'All' }, { value: '10', label: '10 yrs' }, { value: '5', label: '5 yrs' }]} />}
    >
      <Chart option={priceOpt} height={340} ariaLabel={`Line chart of typical house price over time for ${areaName}`} />
      <h3 className="mini-title">Houses sold per quarter</h3>
      <Chart option={salesOpt} height={170} ariaLabel={`Bar chart of house sales per quarter for ${areaName}`} />
    </Section>
  );
}
