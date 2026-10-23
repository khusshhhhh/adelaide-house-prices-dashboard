import { useCallback, useEffect, useMemo, useState } from 'react';
import { areaSeries, inCouncil, loadData, suburbMetrics, type RawData } from './lib/data';
import { quarterLabel, quarterMonths, titleCase } from './lib/format';
import { useTheme } from './lib/theme';
import { Kpis } from './components/Kpis';
import { Insights } from './components/Insights';
import { TrendSection } from './components/TrendSection';
import { MapSection } from './components/MapSection';
import { CouncilHeatmap, CouncilSection } from './components/CouncilSection';
import { DistributionSection } from './components/DistributionSection';
import { Leaderboards } from './components/Leaderboards';
import { Explorer } from './components/Explorer';
import { MomentumSection } from './components/MomentumSection';
import { DataTable } from './components/DataTable';
import { Footer } from './components/Footer';
import type { Ctx } from './components/ctx';

const DEFAULT_PICKS = ['NORWOOD', 'GLENELG', 'SALISBURY'];

export default function App() {
  const theme = useTheme();
  const [data, setData] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qi, setQi] = useState(-1);
  const [council, setCouncil] = useState('ALL');
  const [minSales, setMinSales] = useState(10);
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    loadData()
      .then((d) => {
        setData(d);
        setQi(d.quarters.length - 1);
        const names = new Set(d.suburbs.map((s) => s.suburb));
        setPicks(DEFAULT_PICKS.filter((n) => names.has(n)));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const pick = useCallback((name: string) => {
    setPicks((p) => (p.includes(name) ? p : [...p.slice(-3), name]));
    document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const ctx = useMemo<Ctx | null>(() => {
    if (!data || qi < 0) return null;
    const area = data.suburbs.filter((s) => inCouncil(s, council));
    return {
      data,
      qi,
      council,
      minSales,
      palette: theme.palette,
      mode: theme.mode,
      area,
      areaName: council === 'ALL' ? 'Metro Adelaide' : `${titleCase(council)} council area`,
      areaSeries: areaSeries(area, data.quarters.length),
      metroSeries: areaSeries(data.suburbs, data.quarters.length),
      metrics: area.map((s) => suburbMetrics(s, qi)),
      pick,
    };
  }, [data, qi, council, minSales, theme.palette, theme.mode, pick]);

  if (error) return <div className="state">Couldn’t load the data: {error}</div>;
  if (!data || !ctx) return <div className="state"><span className="spinner" /> Loading Adelaide house sales…</div>;

  const q = data.quarters[qi];

  return (
    <>
      <header className="hero">
        <div className="wrap hero-inner">
          <div>
            <p className="eyebrow">South Australia · Valuer-General settlement data</p>
            <h1>Adelaide Metro House Prices</h1>
            <p className="lede">
              Quarterly median house sale prices and sales volumes for {data.suburbs.length} suburbs across {data.councils.length} council areas,
              {' '}{quarterLabel(data.quarters[0])} – {quarterLabel(data.latestQuarter)}.
            </p>
          </div>
          <div className="hero-meta">
            <span className="badge"><span className="dot" /> Latest data: {quarterLabel(data.latestQuarter)}</span>
            <span className="meta-line">Refreshed {new Date(data.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <div className="hero-actions">
              <a className="btn ghost" href="/data/adelaide-median-house-sales.csv" download>Download CSV</a>
              <button className="btn ghost" onClick={theme.toggle} aria-label="Toggle colour theme">
                {theme.mode === 'light' ? '☾ Dark' : '☀ Light'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="filters-bar">
        <div className="wrap filters">
          <label>
            <span>Quarter</span>
            <select value={qi} onChange={(e) => setQi(Number(e.target.value))}>
              {data.quarters.map((qq, i) => <option key={qq} value={i}>{quarterLabel(qq)}</option>).reverse()}
            </select>
          </label>
          <label>
            <span>Area</span>
            <select value={council} onChange={(e) => setCouncil(e.target.value)}>
              <option value="ALL">All of Metro Adelaide</option>
              {data.councils.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          </label>
          <label>
            <span>Min. sales for rankings (12 mo)</span>
            <select value={minSales} onChange={(e) => setMinSales(Number(e.target.value))}>
              {[4, 10, 20, 40].map((n) => <option key={n} value={n}>{n}+ sales</option>)}
            </select>
          </label>
          <div className="filters-note">Showing <strong>{ctx.areaName}</strong> · {quarterMonths(q)}</div>
        </div>
      </div>

      <main className="wrap">
        <Kpis ctx={ctx} />
        <Insights ctx={ctx} />
        <TrendSection ctx={ctx} />
        <MapSection ctx={ctx} />
        <div className="grid-2">
          <CouncilSection ctx={ctx} onCouncil={setCouncil} />
          <DistributionSection ctx={ctx} />
        </div>
        <CouncilHeatmap ctx={ctx} />
        <Leaderboards ctx={ctx} />
        <MomentumSection ctx={ctx} />
        <Explorer ctx={ctx} picks={picks} setPicks={setPicks} />
        <DataTable ctx={ctx} />
      </main>
      <Footer data={data} />
    </>
  );
}
