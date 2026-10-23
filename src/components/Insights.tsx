import type { ReactNode } from 'react';
import { areaTtm, growth, inCouncil } from '../lib/data';
import { money, num, pct, quarterLabel, titleCase } from '../lib/format';
import type { Ctx } from './ctx';

/** Plain-English summary generated from the data for the current filters. */
export function Insights({ ctx }: { ctx: Ctx }) {
  const { data, qi, areaSeries: series, metrics, area, areaName, minSales, council } = ctx;
  const q = data.quarters[qi];
  const cur = series[qi];
  const items: { tone: 'up' | 'down' | 'flat'; text: ReactNode }[] = [];
  const tone = (n: number | null) => (n == null ? 'flat' : n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

  // Price headline.
  const t = areaTtm(area, qi), t1 = qi >= 4 ? areaTtm(area, qi - 4) : null, t5 = qi >= 20 ? areaTtm(area, qi - 20) : null, t10 = qi >= 40 ? areaTtm(area, qi - 40) : null;
  const g1 = growth(t?.price, t1?.price), g5 = growth(t?.price, t5?.price), g10 = growth(t?.price, t10?.price);
  items.push({
    tone: tone(g1),
    text: <>Over the 12 months to {quarterLabel(q)}, the typical house in {areaName} sold for <b>{money(t?.price)}</b>,{' '}
      <b>{pct(g1)}</b> on the year before{g5 != null && <> and <b>{pct(g5)}</b> on five years earlier</>}
      {g10 != null && <> (<b>{pct(g10, 0)}</b> over ten years)</>}.</>,
  });

  // Volume vs history for the same quarter of the year.
  const sameQ = series.map((p, i) => ({ i, sales: p.sales })).filter((p) => p.i % 4 === qi % 4 && p.i <= qi);
  const rank = [...sameQ].sort((a, b) => b.sales - a.sales).findIndex((p) => p.i === qi) + 1;
  const yoySales = qi >= 4 ? growth(cur.sales, series[qi - 4].sales) : null;
  items.push({
    tone: tone(yoySales),
    text: <><b>{num(cur.sales)}</b> house sales were recorded in {quarterLabel(q)} ({pct(yoySales)} vs a year earlier) — the{' '}
      {rank === 1 ? <b>busiest</b> : rank === sameQ.length ? <b>quietest</b> : <b>{ordinal(rank)} busiest</b>} Q{(qi % 4) + 1} of the {sameQ.length} on record.</>,
  });

  // Breadth and standouts.
  const ranked = metrics.filter((m) => m.ttmSales >= minSales && m.ttmGrowth != null).sort((a, b) => b.ttmGrowth! - a.ttmGrowth!);
  if (ranked.length >= 3) {
    const rising = ranked.filter((m) => m.ttmGrowth! > 0).length;
    const best = ranked[0], worst = ranked[ranked.length - 1];
    items.push({
      tone: rising / ranked.length >= 0.5 ? 'up' : 'down',
      text: <><b>{rising} of {ranked.length}</b> suburbs ({minSales}+ sales) saw 12-month prices rise. Strongest:{' '}
        <b>{titleCase(best.s.suburb)}</b> ({pct(best.ttmGrowth)}); weakest: <b>{titleCase(worst.s.suburb)}</b> ({pct(worst.ttmGrowth)}).</>,
    });
  }

  // Council race (metro view only).
  if (council === 'ALL') {
    const councils = data.councils.map((c) => {
      const sub = data.suburbs.filter((s) => inCouncil(s, c));
      const a = areaTtm(sub, qi), b = qi >= 4 ? areaTtm(sub, qi - 4) : null;
      return { c, g: growth(a?.price, b?.price), sales: a?.sales ?? 0 };
    }).filter((x) => x.g != null && x.sales >= 50).sort((a, b) => b.g! - a.g!);
    if (councils.length > 2) {
      const best = councils[0], worst = councils[councils.length - 1];
      items.push({
        tone: 'flat',
        text: <>Fastest-growing council area: <b>{titleCase(best.c)}</b> ({pct(best.g)} over 12 months). Slowest: <b>{titleCase(worst.c)}</b> ({pct(worst.g)}).</>,
      });
    }
  }

  // Affordability.
  const withMed = metrics.filter((m) => m.median != null);
  const under600 = withMed.filter((m) => m.median! < 600_000).length;
  if (qi >= 20) {
    const then = area.filter((s) => s.median[qi - 20] != null);
    const thenUnder = then.filter((s) => s.median[qi - 20]! < 600_000).length;
    items.push({
      tone: under600 < thenUnder ? 'down' : 'up',
      text: <>Affordability: <b>{under600}</b> of {withMed.length} suburbs had a median under $600k this quarter, compared with <b>{thenUnder}</b> of {then.length} in {quarterLabel(data.quarters[qi - 20])}.</>,
    });
  }

  const records = withMed.filter((m) => m.isRecord && (m.sales ?? 0) >= 3);
  if (records.length) {
    items.push({
      tone: 'up',
      text: <><b>{records.length}</b> suburb{records.length === 1 ? '' : 's'} recorded {records.length === 1 ? 'its' : 'their'} highest quarterly median on record, including{' '}
        {records.sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0)).slice(0, 3).map((m, i, arr) => (
          <span key={m.s.suburb}><b>{titleCase(m.s.suburb)}</b> ({money(m.median)}){i < arr.length - 1 ? ', ' : ''}</span>
        ))}.</>,
    });
  }

  return (
    <section className="card insights">
      <div className="card-head"><div><h2>What the data says</h2><p className="sub">Generated automatically from the latest figures for the current filters.</p></div></div>
      <ul>
        {items.map((it, i) => <li key={i} className={it.tone}><span className="bullet" aria-hidden="true" />{it.text}</li>)}
      </ul>
    </section>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
