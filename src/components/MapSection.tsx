import { useEffect, useMemo, useState } from 'react';
import { money, num, pct, quarterLabel, titleCase } from '../lib/format';
import { baseOption } from '../lib/theme';
import { Chart, echarts } from './Chart';
import type { Ctx } from './ctx';
import { Section, Segmented } from './ui';

type Metric = 'price' | 'growth1' | 'growth5' | 'sales';

let mapReady: Promise<void> | null = null;
function ensureMap() {
  mapReady ??= fetch('/data/suburbs.geojson')
    .then((r) => r.json())
    .then((geo) => { echarts.registerMap('adelaide', geo); });
  return mapReady;
}

const PRICE_BREAKS = [500_000, 650_000, 800_000, 1_000_000, 1_300_000, 1_800_000];
const GROWTH1_BREAKS = [-0.1, -0.03, 0.03, 0.1];
const GROWTH5_BREAKS = [0.2, 0.4, 0.6, 0.8];
const SALES_BREAKS = [10, 25, 50, 100, 200];

export function MapSection({ ctx }: { ctx: Ctx }) {
  const [ready, setReady] = useState(false);
  const [metric, setMetric] = useState<Metric>('price');
  const { data, qi, palette: p, metrics, pick, council, mode } = ctx;

  useEffect(() => { ensureMap().then(() => setReady(true)); }, []);

  const option = useMemo(() => {
    if (!ready) return null;
    const inArea = new Set(metrics.map((m) => m.s.suburb));
    const byName = new Map(data.suburbs.map((s) => [s.suburb, s]));
    const metricMap = new Map(metrics.map((m) => [m.s.suburb, m]));

    const value = (name: string): number | null => {
      const m = metricMap.get(name);
      if (!m) return null;
      if (metric === 'price') return m.ttmSales >= 3 ? m.ttmPrice : null;
      if (metric === 'growth1') return m.ttmSales >= 4 ? m.ttmGrowth : null;
      if (metric === 'growth5') return m.ttmSales >= 4 ? m.growth5y : null;
      return m.ttmSales;
    };

    const pieces = (() => {
      const fmt = metric === 'sales' ? num : metric === 'price' ? (v: number) => money(v) : (v: number) => pct(v, 0);
      if (metric === 'growth1') {
        const colors = [p.neg[0], p.neg[1], p.mid, p.pos[1], p.pos[2]];
        const b = GROWTH1_BREAKS;
        return [
          { lt: b[0], color: colors[0], label: `Below ${fmt(b[0])}` },
          { gte: b[0], lt: b[1], color: colors[1], label: `${fmt(b[0])} to ${fmt(b[1])}` },
          { gte: b[1], lt: b[2], color: colors[2], label: `${fmt(b[1])} to ${fmt(b[2])}` },
          { gte: b[2], lt: b[3], color: colors[3], label: `${fmt(b[2])} to ${fmt(b[3])}` },
          { gte: b[3], color: colors[4], label: `Above ${fmt(b[3])}` },
        ];
      }
      const breaks = metric === 'price' ? PRICE_BREAKS : metric === 'growth5' ? GROWTH5_BREAKS : SALES_BREAKS;
      const ramp = p.seq.slice(7 - (breaks.length + 1));
      return ramp.map((color, i) => {
        if (i === 0) return { lt: breaks[0], color, label: `Under ${fmt(breaks[0])}` };
        if (i === breaks.length) return { gte: breaks[i - 1], color, label: `${fmt(breaks[i - 1])}+` };
        return { gte: breaks[i - 1], lt: breaks[i], color, label: `${fmt(breaks[i - 1])} – ${fmt(breaks[i])}` };
      });
    })();

    const seriesData = [...byName.keys()].map((name) => {
      const v = inArea.has(name) ? value(name) : null;
      return {
        name,
        value: v ?? '-',
        itemStyle: inArea.has(name) ? undefined : { areaColor: p.noData, opacity: 0.35 },
      };
    });

    return {
      ...baseOption(p),
      tooltip: {
        ...baseOption(p).tooltip,
        trigger: 'item',
        formatter: (prm: any) => {
          const m = metricMap.get(prm.name);
          const s = byName.get(prm.name);
          if (!s) return titleCase(prm.name);
          const head = `<b style="font-size:13px">${titleCase(s.suburb)}</b> <span style="color:${p.muted}">${s.postcode ?? ''}</span><br/><span style="color:${p.muted}">${s.councils.map(titleCase).join(' / ')}</span>`;
          if (!m) return head + `<br/><span style="color:${p.muted}">Outside selected area</span>`;
          const row = (k: string, v: string) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.ink2}">${k}</span><b>${v}</b></div>`;
          return head + '<div style="margin-top:6px">' +
            row('Quarter median', m.median ? `${money(m.median, false)} (${m.sales} sales)` : 'no sales') +
            row('12-month price', money(m.ttmPrice, false)) +
            row('12-month change', pct(m.ttmGrowth)) +
            row('5-year change', pct(m.growth5y)) +
            row('Sales, last 12 months', num(m.ttmSales)) +
            `</div><div style="color:${p.muted};margin-top:6px">Click to add to Suburb Explorer</div>`;
        },
      },
      visualMap: {
        type: 'piecewise', pieces, left: 8, bottom: 8, orient: 'vertical', itemWidth: 14, itemHeight: 10, itemGap: 4,
        textStyle: { color: p.ink2, fontSize: 11 }, outOfRange: { color: p.noData },
        backgroundColor: mode === 'dark' ? 'rgba(26,26,25,.85)' : 'rgba(252,252,251,.85)', padding: 8, borderRadius: 8,
      },
      series: [{
        type: 'map', map: 'adelaide', roam: true, scaleLimit: { min: 0.8, max: 12 },
        ...(council === 'ALL' ? { zoom: 1.6, center: [138.62, -34.92] } : {}),
        aspectScale: 0.82,
        data: seriesData,
        itemStyle: { borderColor: p.surface, borderWidth: 0.6, areaColor: p.noData },
        emphasis: { label: { show: true, color: p.ink, fontWeight: 600, formatter: (x: any) => titleCase(x.name), textBorderColor: p.surface, textBorderWidth: 3 },
          itemStyle: { areaColor: undefined, borderColor: p.ink, borderWidth: 1.5 } },
        select: { disabled: true },
        label: { show: false },
      }],
    };
  }, [ready, metric, metrics, data, p, council, mode]);

  const desc: Record<Metric, string> = {
    price: '12-month typical price (sales-weighted over the last four quarters, min. 3 sales).',
    growth1: 'Change in 12-month typical price vs a year earlier. Red = falling, blue = rising.',
    growth5: 'Change in 12-month typical price vs five years earlier.',
    sales: 'Number of houses sold over the last 12 months.',
  };

  return (
    <Section
      title="Suburb map"
      subtitle={<>{desc[metric]} Scroll or pinch to zoom, drag to pan, click a suburb to explore it. Grey = not enough sales{council !== 'ALL' ? ' or outside the selected council' : ''}.</>}
      actions={<Segmented label="Map metric" value={metric} onChange={setMetric} options={[
        { value: 'price', label: 'Price' }, { value: 'growth1', label: '1-yr change' }, { value: 'growth5', label: '5-yr change' }, { value: 'sales', label: 'Sales' },
      ]} />}
    >
      {option ? (
        <Chart option={option} height={620} ariaLabel={`Map of Adelaide suburbs coloured by ${metric}`}
          onEvents={{ click: (e) => e.name && metrics.some((m) => m.s.suburb === e.name) && pick(e.name) }} />
      ) : <div className="chart-loading" style={{ height: 620 }}>Loading map…</div>}
      <p className="note">12 months to {quarterLabel(data.quarters[qi])}. Boundaries: SA Government Suburbs &amp; Localities.</p>
    </Section>
  );
}
