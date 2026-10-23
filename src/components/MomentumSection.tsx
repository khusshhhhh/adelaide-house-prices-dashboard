import { useMemo } from 'react';
import { growth, ttm } from '../lib/data';
import { num, pct, quarterLabel } from '../lib/format';
import { axisStyle, baseOption } from '../lib/theme';
import { Chart } from './Chart';
import type { Ctx } from './ctx';
import { Section } from './ui';

/** Market breadth (rising vs falling suburbs each quarter) and sales seasonality. */
export function MomentumSection({ ctx }: { ctx: Ctx }) {
  const { data, qi, palette: p, area, areaSeries: series, minSales } = ctx;

  const breadth = useMemo(() => {
    const idx = data.quarters.map((_, i) => i).filter((i) => i >= 7 && i <= qi);
    const up: number[] = [], down: number[] = [], net: number[] = [];
    for (const i of idx) {
      let u = 0, d = 0;
      for (const s of area) {
        const a = ttm(s, i), b = ttm(s, i - 4);
        if (!a || !b || a.sales < minSales) continue;
        const g = growth(a.price, b.price)!;
        if (g > 0) u++; else if (g < 0) d++;
      }
      up.push(u); down.push(-d); net.push(u + d ? (u - d) / (u + d) : 0);
    }
    const ax = axisStyle(p);
    return {
      ...baseOption(p),
      grid: { left: 44, right: 12, top: 40, bottom: 28 },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: p.ink2 } },
      tooltip: {
        ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } },
        formatter: (ps: any[]) => {
          const k = ps[0].dataIndex;
          return `<b>${ps[0].axisValue}</b><br/>Rising: <b>${up[k]}</b> suburbs<br/>Falling: <b>${-down[k]}</b> suburbs<br/><span style="color:${p.muted}">Net breadth ${pct(net[k], 0)}</span>`;
        },
      },
      xAxis: { type: 'category', data: idx.map((i) => quarterLabel(data.quarters[i])), ...ax, splitLine: { show: false },
        axisLabel: { ...ax.axisLabel, interval: (k: number) => idx[k] % 4 === 0, formatter: (v: string) => v.slice(3) } },
      yAxis: { type: 'value', ...ax, axisLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: (v: number) => num(Math.abs(v)) } },
      series: [
        { name: 'Suburbs rising', type: 'bar', stack: 'b', data: up, barCategoryGap: '20%', itemStyle: { color: p.up, borderRadius: [3, 3, 0, 0] } },
        { name: 'Suburbs falling', type: 'bar', stack: 'b', data: down, itemStyle: { color: p.down, borderRadius: [0, 0, 3, 3] } },
      ],
    };
  }, [data, qi, area, p, minSales]);

  const seasonal = useMemo(() => {
    const avg = [0, 1, 2, 3].map((k) => {
      const v = series.filter((_, i) => i % 4 === k && i <= qi).map((x) => x.sales);
      return v.reduce((a, b) => a + b, 0) / (v.length || 1);
    });
    const ax = axisStyle(p);
    return {
      ...baseOption(p),
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: { ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } }, valueFormatter: (v: number) => num(v) + ' sales on average' },
      xAxis: { type: 'category', data: ['Q1 Jan–Mar', 'Q2 Apr–Jun', 'Q3 Jul–Sep', 'Q4 Oct–Dec'], ...ax, splitLine: { show: false } },
      yAxis: { type: 'value', ...ax, axisLine: { show: false } },
      series: [{
        type: 'bar', barWidth: '46%', data: avg.map((v, k) => ({ value: Math.round(v), itemStyle: { color: k === qi % 4 ? p.series[0] : p.seq[2], borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', color: p.ink2, fontSize: 11, formatter: (v: any) => num(v.value) },
      }],
    };
  }, [series, qi, p]);

  return (
    <div className="grid-2 wide-left">
      <Section title="Market breadth" subtitle={<>How many suburbs ({minSales}+ sales) had a higher vs lower 12-month typical price than a year earlier, each quarter. Broad blue = a rising tide; red = a widespread pull-back.</>}>
        <Chart option={breadth} height={320} ariaLabel="Diverging bar chart of rising vs falling suburbs per quarter" />
      </Section>
      <Section title="Seasonality" subtitle="Average houses sold per quarter of the year, all years. The selected quarter is highlighted.">
        <Chart option={seasonal} height={320} ariaLabel="Bar chart of average sales per quarter of year" />
      </Section>
    </div>
  );
}
