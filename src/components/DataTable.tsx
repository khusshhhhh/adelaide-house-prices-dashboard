import { useMemo, useState } from 'react';
import type { SuburbMetrics } from '../lib/data';
import { deltaClass, money, num, pct, quarterLabel, titleCase } from '../lib/format';
import type { Ctx } from './ctx';
import { Section, Sparkline } from './ui';

type Key = 'suburb' | 'postcode' | 'council' | 'median' | 'sales' | 'yoy' | 'ttmPrice' | 'ttmGrowth' | 'growth5y' | 'cagr10y' | 'ttmSales';

const COLUMNS: { key: Key; label: string; num?: boolean; title?: string }[] = [
  { key: 'suburb', label: 'Suburb' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'council', label: 'Council' },
  { key: 'median', label: 'Qtr median', num: true, title: 'Median sale price in the selected quarter' },
  { key: 'sales', label: 'Qtr sales', num: true },
  { key: 'yoy', label: 'Qtr vs yr ago', num: true, title: 'Quarterly median vs the same quarter a year earlier (as published)' },
  { key: 'ttmPrice', label: '12-mo price', num: true, title: 'Sales-weighted price over the last four quarters' },
  { key: 'ttmGrowth', label: '1-yr chg', num: true },
  { key: 'growth5y', label: '5-yr chg', num: true },
  { key: 'cagr10y', label: '10-yr p.a.', num: true },
  { key: 'ttmSales', label: '12-mo sales', num: true },
];

const PAGE = 25;

export function DataTable({ ctx }: { ctx: Ctx }) {
  const { metrics, data, qi, palette: p, pick } = ctx;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'ttmSales', dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const term = q.trim().toUpperCase();
    const get = (m: SuburbMetrics): string | number | null => {
      switch (sort.key) {
        case 'suburb': return m.s.suburb;
        case 'postcode': return m.s.postcode;
        case 'council': return m.s.council;
        default: return m[sort.key];
      }
    };
    return metrics
      .filter((m) => !term || m.s.suburb.includes(term) || m.s.postcode?.startsWith(term) || m.s.councils.some((c) => c.includes(term)))
      .sort((a, b) => {
        const x = get(a), y = get(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
      });
  }, [metrics, q, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const sparkFrom = Math.max(0, qi - 19);

  const onSort = (key: Key) => {
    setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : COLUMNS.find((c) => c.key === key)!.num ? -1 : 1 }));
    setPage(0);
  };

  const exportCsv = () => {
    const head = ['Suburb', 'Postcode', 'Councils', 'Quarter', 'Quarter median', 'Quarter sales', 'Quarter vs year ago', '12-month price', '1-year change', '5-year change', '10-year growth p.a.', '12-month sales'];
    const lines = rows.map((m) => [
      `"${titleCase(m.s.suburb)}"`, m.s.postcode ?? '', `"${m.s.councils.map(titleCase).join('; ')}"`, data.quarters[qi],
      m.median ?? '', m.sales ?? '', m.yoy?.toFixed(4) ?? '', m.ttmPrice ? Math.round(m.ttmPrice) : '', m.ttmGrowth?.toFixed(4) ?? '',
      m.growth5y?.toFixed(4) ?? '', m.cagr10y?.toFixed(4) ?? '', m.ttmSales,
    ].join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adelaide-suburbs-${data.quarters[qi]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pctCell = (v: number | null) => <td className={`num ${deltaClass(v)}`}>{pct(v)}</td>;

  return (
    <Section
      title="All suburbs"
      subtitle={<>Every suburb in the selected area at {quarterLabel(data.quarters[qi])}. Click a column to sort, a row to explore. Trend line = last 5 years of quarterly medians.</>}
      actions={<button className="btn" onClick={exportCsv}>Export this table</button>}
    >
      <div className="table-tools">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Filter by suburb, postcode or council…" aria-label="Filter table" />
        <span className="muted">{rows.length} suburbs</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} title={c.title} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => onSort(c.key)}>{c.label}{sort.key === c.key && <span aria-hidden="true">{sort.dir === 1 ? ' ↑' : ' ↓'}</span>}</button>
                </th>
              ))}
              <th>5-yr trend</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.s.suburb} onClick={() => pick(m.s.suburb)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && pick(m.s.suburb)}>
                <td className="strong">{titleCase(m.s.suburb)}</td>
                <td>{m.s.postcode}</td>
                <td className="muted">{m.s.councils.map(titleCase).join(' / ')}</td>
                <td className="num">{money(m.median, false)}</td>
                <td className="num">{num(m.sales)}</td>
                {pctCell(m.yoy)}
                <td className="num">{money(m.ttmPrice)}</td>
                {pctCell(m.ttmGrowth)}
                {pctCell(m.growth5y)}
                {pctCell(m.cagr10y)}
                <td className="num">{num(m.ttmSales)}</td>
                <td><Sparkline values={m.s.median.slice(sparkFrom, qi + 1)} color={p.series[0]} highlightLast={false} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="btn" disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Prev</button>
        <span className="muted">Page {cur + 1} of {pages}</span>
        <button className="btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next →</button>
      </div>
    </Section>
  );
}
