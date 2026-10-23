import { useMemo, useRef, useState } from 'react';
import { suburbMetrics, ttm } from '../lib/data';
import { money, num, quarterLabel, titleCase } from '../lib/format';
import { axisStyle, baseOption } from '../lib/theme';
import { Chart } from './Chart';
import type { Ctx } from './ctx';
import { Delta, Section, Segmented } from './ui';

const MAX = 4;

export function Explorer({ ctx, picks, setPicks }: { ctx: Ctx; picks: string[]; setPicks: (f: (p: string[]) => string[]) => void }) {
  const { data, qi, palette: p } = ctx;
  const [query, setQuery] = useState('');
  const [smooth, setSmooth] = useState<'q' | 'ttm'>('ttm');

  // Colour follows the suburb: each keeps its slot until removed.
  const slots = useRef(new Map<string, number>());
  for (const k of [...slots.current.keys()]) if (!picks.includes(k)) slots.current.delete(k);
  for (const k of picks) {
    if (!slots.current.has(k)) {
      const used = new Set(slots.current.values());
      slots.current.set(k, [0, 1, 2, 3].find((i) => !used.has(i)) ?? 0);
    }
  }
  const colorOf = (name: string) => p.series[slots.current.get(name) ?? 0];

  const bySuburb = useMemo(() => new Map(data.suburbs.map((s) => [s.suburb, s])), [data]);
  const chosen = picks.map((n) => bySuburb.get(n)).filter((s): s is NonNullable<typeof s> => !!s);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return data.suburbs
      .filter((s) => !picks.includes(s.suburb) && (s.suburb.includes(q) || s.postcode?.startsWith(q)))
      .sort((a, b) => Number(!a.suburb.startsWith(q)) - Number(!b.suburb.startsWith(q)) || a.suburb.localeCompare(b.suburb))
      .slice(0, 8);
  }, [query, data, picks]);

  const add = (name: string) => { setPicks((ps) => (ps.includes(name) ? ps : [...ps.slice(-(MAX - 1)), name])); setQuery(''); };
  const remove = (name: string) => setPicks((ps) => ps.filter((x) => x !== name));

  const { priceOpt, salesOpt } = useMemo(() => {
    const idx = data.quarters.map((_, i) => i).filter((i) => i <= qi);
    const x = idx.map((i) => quarterLabel(data.quarters[i]));
    const ax = axisStyle(p);
    const xAxis = { type: 'category', data: x, ...ax, splitLine: { show: false },
      axisLabel: { ...ax.axisLabel, interval: (k: number) => idx[k] % 4 === 0, formatter: (v: string) => v.slice(3) } };
    const legend = { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: p.ink2 } };
    const priceOpt = {
      ...baseOption(p),
      grid: { left: 64, right: 24, top: 40, bottom: 28 },
      legend,
      tooltip: { ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: p.axis } }, valueFormatter: (v: number) => money(v, false) },
      xAxis: { ...xAxis, boundaryGap: false },
      yAxis: { type: 'value', scale: true, ...ax, axisLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: (v: number) => money(v) } },
      series: chosen.map((s) => ({
        name: titleCase(s.suburb), type: 'line', connectNulls: true, showSymbol: smooth === 'q', symbolSize: 6, symbol: 'circle',
        data: idx.map((i) => (smooth === 'q' ? s.median[i] : ttm(s, i)?.price ?? null)),
        lineStyle: { width: 2, color: colorOf(s.suburb) }, itemStyle: { color: colorOf(s.suburb), borderColor: p.surface, borderWidth: 2 },
      })),
    };
    const salesOpt = {
      ...baseOption(p),
      grid: { left: 64, right: 24, top: 36, bottom: 28 },
      legend: { ...legend, itemHeight: 12, itemWidth: 12 },
      tooltip: { ...baseOption(p).tooltip, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: p.grid + '88' } }, valueFormatter: (v: number) => num(v) + ' sales' },
      xAxis,
      yAxis: { type: 'value', ...ax, axisLine: { show: false }, splitNumber: 3 },
      series: chosen.map((s) => ({
        name: titleCase(s.suburb), type: 'bar', data: idx.map((i) => s.sales[i] ?? 0), barGap: '0%',
        itemStyle: { color: colorOf(s.suburb), borderRadius: [2, 2, 0, 0] },
      })),
    };
    return { priceOpt, salesOpt };
  }, [chosen.map((s) => s.suburb).join(), qi, p, smooth, data]);

  return (
    <Section
      id="explorer"
      title="Suburb explorer"
      subtitle={<>Compare up to {MAX} suburbs over time. Search by name or postcode, or click any suburb on the map, leaderboards or table.</>}
      actions={<Segmented label="Price series" value={smooth} onChange={setSmooth} options={[{ value: 'ttm', label: '12-month' }, { value: 'q', label: 'Quarterly' }]} />}
    >
      <div className="explorer-bar">
        <div className="search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suburb or postcode…" aria-label="Search suburb"
            onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) add(matches[0].suburb); }} />
          {matches.length > 0 && (
            <ul className="suggest" role="listbox">
              {matches.map((s) => (
                <li key={s.suburb}><button onClick={() => add(s.suburb)}>{titleCase(s.suburb)} <small>{s.postcode} · {titleCase(s.council)}</small></button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="chips">
          {chosen.map((s) => (
            <span className="chip" key={s.suburb}>
              <span className="swatch" style={{ background: colorOf(s.suburb) }} />
              {titleCase(s.suburb)}
              <button onClick={() => remove(s.suburb)} aria-label={`Remove ${titleCase(s.suburb)}`}>×</button>
            </span>
          ))}
          {!chosen.length && <span className="muted">No suburbs selected yet.</span>}
        </div>
      </div>

      {chosen.length > 0 && (
        <>
          <div className="suburb-cards">
            {chosen.map((s) => {
              const m = suburbMetrics(s, qi);
              const sameCouncil = data.suburbs.filter((o) => o.councils.some((c) => s.councils.includes(c)));
              const rank = [...sameCouncil].map((o) => ({ o, v: ttm(o, qi)?.price ?? 0 })).sort((a, b) => b.v - a.v).findIndex((r) => r.o === s) + 1;
              return (
                <div className="suburb-card" key={s.suburb} style={{ borderTopColor: colorOf(s.suburb) }}>
                  <div className="sc-head">
                    <h3>{titleCase(s.suburb)}</h3>
                    <span className="muted">{s.postcode} · {s.councils.map(titleCase).join(' / ')}</span>
                  </div>
                  <div className="sc-main">
                    <div><span className="sc-label">12-month price</span><span className="sc-big">{money(m.ttmPrice)}</span></div>
                    <div><span className="sc-label">{quarterLabel(data.quarters[qi])} median</span><span className="sc-big">{m.median ? money(m.median) : '–'}</span></div>
                  </div>
                  <dl>
                    <dt>1-year change</dt><dd><Delta value={m.ttmGrowth} /></dd>
                    <dt>5-year change</dt><dd><Delta value={m.growth5y} /></dd>
                    <dt>10-yr growth p.a.</dt><dd><Delta value={m.cagr10y} /></dd>
                    <dt>Sales, last 12 mo</dt><dd>{num(m.ttmSales)}</dd>
                    <dt>Record quarter</dt><dd>{m.peak ? <>{money(m.peak)} <small className="muted">{quarterLabel(data.quarters[m.peakQi!])}</small></> : '–'}</dd>
                    <dt>Price rank in council</dt><dd>{rank ? `#${rank} of ${sameCouncil.length}` : '–'}</dd>
                  </dl>
                  {m.ttmSales < 10 && <p className="warn-note">Few sales — figures for this suburb are volatile.</p>}
                </div>
              );
            })}
          </div>
          <Chart option={priceOpt} height={340} ariaLabel="Line chart comparing selected suburbs' prices" />
          <h3 className="mini-title">Houses sold per quarter</h3>
          <Chart option={salesOpt} height={200} ariaLabel="Bar chart comparing selected suburbs' sales" />
          <p className="note">Quarterly medians in small suburbs can swing sharply on just a few sales; the 12-month view weights each quarter by its number of sales.</p>
        </>
      )}
    </Section>
  );
}
