import { useMemo, useState } from 'react';
import { areaTtm, growth, inCouncil } from '../lib/data';
import { money, num, pct, quarterLabel, titleCase } from '../lib/format';
import { axisStyle, baseOption } from '../lib/theme';
import { Chart } from './Chart';
import type { Ctx } from './ctx';
import { Section, Segmented } from './ui';

type Measure = 'price' | 'growth1' | 'growth5';

export function CouncilSection({ ctx, onCouncil }: { ctx: Ctx; onCouncil: (c: string) => void }) {
  const [measure, setMeasure] = useState<Measure>('price');
  const { data, qi, palette: p, council } = ctx;

  const rows = useMemo(() => data.councils.map((c) => {
    const sub = data.suburbs.filter((s) => inCouncil(s, c));
    const t = areaTtm(sub, qi), t1 = qi >= 4 ? areaTtm(sub, qi - 4) : null, t5 = qi >= 20 ? areaTtm(sub, qi - 20) : null;
    return { c, price: t?.price ?? null, sales: t?.sales ?? 0, growth1: growth(t?.price, t1?.price), growth5: growth(t?.price, t5?.price), suburbs: sub.length };
  }).filter((r) => r.price != null && r.sales >= 20), [data, qi]);

  const option = useMemo(() => {
    const sorted = [...rows].filter((r) => r[measure] != null).sort((a, b) => (a[measure]! - b[measure]!));
    const ax = axisStyle(p);
    const isPct = measure !== 'price';
    return {
      ...baseOption(p),
      grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        ...baseOption(p).tooltip, trigger: 'item',
        formatter: (prm: any) => {
          const r = sorted[prm.dataIndex];
          return `<b>${titleCase(r.c)}</b><br/>12-month typical price: <b>${money(r.price, false)}</b><br/>1-year change: <b>${pct(r.growth1)}</b><br/>5-year change: <b>${pct(r.growth5)}</b><br/><span style="color:${p.muted}">${num(r.sales)} sales · ${r.suburbs} suburbs · click to filter</span>`;
        },
      },
      xAxis: { type: 'value', ...ax, axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: sorted.map((r) => titleCase(r.c)), ...ax, axisLine: { show: false }, axisLabel: { color: p.ink2, fontSize: 11 } },
      series: [{
        type: 'bar', barCategoryGap: '28%',
        data: sorted.map((r) => ({
          value: r[measure],
          itemStyle: {
            color: council !== 'ALL' && r.c !== council ? p.axis
              : isPct && r[measure]! < 0 ? p.down : p.series[0],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: { show: true, position: 'right', color: p.ink2, fontSize: 11, formatter: (v: any) => (isPct ? pct(v.value, 1) : money(v.value)) },
      }],
    };
  }, [rows, measure, p, council]);

  return (
    <Section
      title="Council areas compared"
      subtitle={<>12 months to {quarterLabel(data.quarters[qi])}. Includes every suburb wholly or partly inside each council. Click a bar to filter the dashboard.</>}
      actions={<Segmented label="Council measure" value={measure} onChange={setMeasure} options={[
        { value: 'price', label: 'Price' }, { value: 'growth1', label: '1 yr' }, { value: 'growth5', label: '5 yrs' },
      ]} />}
    >
      <Chart option={option} height={Math.max(360, rows.length * 24 + 20)} ariaLabel="Bar chart comparing council areas"
        onEvents={{ click: (e) => { const name = data.councils.find((c) => titleCase(c) === e.name); if (name) onCouncil(name === council ? 'ALL' : name); } }} />
    </Section>
  );
}

/** Calendar-year growth per council, as a diverging heatmap. */
export function CouncilHeatmap({ ctx }: { ctx: Ctx }) {
  const { data, qi, palette: p } = ctx;

  const option = useMemo(() => {
    // Year-end points: every Q4 up to the selected quarter, plus the selected quarter if it isn't a Q4.
    const ends: number[] = [];
    for (let i = 3; i <= qi; i += 4) ends.push(i);
    if (qi % 4 !== 3) ends.push(qi);
    const cols = ends.filter((i) => i >= 7); // need a prior year to compare
    const labels = cols.map((i) => (i % 4 === 3 ? data.quarters[i].slice(0, 4) : `12m to ${quarterLabel(data.quarters[i])}`));

    const councils = data.councils.filter((c) => data.suburbs.some((s) => inCouncil(s, c)));
    const rows = councils.map((c) => {
      const sub = data.suburbs.filter((s) => inCouncil(s, c));
      const vals = cols.map((i) => {
        const a = areaTtm(sub, i), b = areaTtm(sub, i - 4);
        const g = (a?.sales ?? 0) >= 20 && (b?.sales ?? 0) >= 20 ? growth(a?.price, b?.price) : null;
        return { g, sales: a?.sales ?? 0 };
      });
      const known = vals.filter((v) => v.g != null);
      return { c, vals, avg: known.length ? known.reduce((t, v) => t + v.g!, 0) / known.length : null };
    }).filter((r) => r.avg != null).sort((a, b) => a.avg! - b.avg!);
    const order = rows.map((r) => r.c);
    const bucket = (v: number) => (v < -5 ? p.neg[0] : v < 0 ? p.neg[2] : v < 5 ? p.mid : v < 10 ? p.pos[0] : v < 20 ? p.pos[1] : p.pos[2]);
    const plotted = rows.flatMap((r, y) => r.vals.map((v, x) => {
      const val = v.g == null ? '-' : +(v.g * 100).toFixed(1);
      return { value: [x, y, val, v.sales], label: { color: val === '-' ? p.ink : textOn(bucket(val as number)) } };
    }));

    const ax = axisStyle(p);
    return {
      ...baseOption(p),
      grid: { left: 8, right: 16, top: 8, bottom: 70, containLabel: true },
      tooltip: {
        ...baseOption(p).tooltip, trigger: 'item',
        formatter: (prm: any) => {
          const [x, y, v, s] = prm.data.value;
          return `<b>${titleCase(order[y])}</b> · ${labels[x]}<br/>Price change: <b>${v === '-' ? 'not enough sales' : pct(v / 100)}</b><br/><span style="color:${p.muted}">${num(s)} sales in the period</span>`;
        },
      },
      xAxis: { type: 'category', data: labels, ...ax, axisLine: { show: false }, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 0 } },
      yAxis: { type: 'category', data: order.map(titleCase), ...ax, axisLine: { show: false }, splitLine: { show: false }, axisLabel: { color: p.ink2, fontSize: 11 } },
      visualMap: {
        type: 'piecewise', dimension: 2, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 16, itemHeight: 10, textStyle: { color: p.ink2, fontSize: 11 },
        pieces: [
          { lt: -5, color: p.neg[0], label: '< −5%' },
          { gte: -5, lt: 0, color: p.neg[2], label: '−5–0%' },
          { gte: 0, lt: 5, color: p.mid, label: '0–5%' },
          { gte: 5, lt: 10, color: p.pos[0], label: '5–10%' },
          { gte: 10, lt: 20, color: p.pos[1], label: '10–20%' },
          { gte: 20, color: p.pos[2], label: '20%+' },
        ],
      },
      series: [{
        type: 'heatmap', data: plotted,
        itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 4 },
        label: { show: true, fontSize: 10, color: p.ink, formatter: (prm: any) => (prm.data.value[2] === '-' ? '' : Math.round(prm.data.value[2])) },
        emphasis: { itemStyle: { borderColor: p.ink, borderWidth: 1.5 } },
      }],
    };
  }, [data, qi, p]);

  return (
    <Section
      title="Annual price growth by council"
      subtitle="Year-on-year change in each council's 12-month typical price (%). Councils are ordered by average growth — fastest at the top."
    >
      <div className="scroll-x"><div style={{ minWidth: 760 }}>
        <Chart option={option} height={620} ariaLabel="Heatmap of annual price growth by council and year" />
      </div></div>
    </Section>
  );
}

/** Black or white text, whichever reads better on the given fill. */
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.22 ? '#0b0b0b' : '#ffffff';
}
