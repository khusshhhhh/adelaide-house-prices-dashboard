import type { SuburbMetrics } from '../lib/data';
import { money, num, pct, quarterLabel, titleCase } from '../lib/format';
import type { Ctx } from './ctx';
import { Section } from './ui';

interface Board {
  title: string;
  hint: string;
  rows: SuburbMetrics[];
  value: (m: SuburbMetrics) => number;
  fmt: (v: number) => string;
  extra: (m: SuburbMetrics) => string;
  tone: 'up' | 'down' | 'neutral';
}

export function Leaderboards({ ctx }: { ctx: Ctx }) {
  const { metrics, minSales, data, qi, pick } = ctx;
  const eligible = metrics.filter((m) => m.ttmSales >= minSales && m.ttmPrice != null);
  const by = (f: (m: SuburbMetrics) => number | null, dir: 1 | -1) =>
    eligible.filter((m) => f(m) != null).sort((a, b) => dir * (f(b)! - f(a)!)).slice(0, 10);

  const boards: Board[] = [
    { title: 'Biggest 12-month rises', hint: 'Change in 12-month typical price', rows: by((m) => m.ttmGrowth, 1), value: (m) => m.ttmGrowth!, fmt: (v) => pct(v), extra: (m) => money(m.ttmPrice), tone: 'up' },
    { title: 'Biggest 12-month falls', hint: 'Change in 12-month typical price', rows: by((m) => m.ttmGrowth, -1).filter((m) => m.ttmGrowth! < 0), value: (m) => m.ttmGrowth!, fmt: (v) => pct(v), extra: (m) => money(m.ttmPrice), tone: 'down' },
    { title: 'Best long-run growth', hint: 'Average annual growth over 10 years', rows: by((m) => m.cagr10y, 1), value: (m) => m.cagr10y!, fmt: (v) => pct(v) + ' p.a.', extra: (m) => money(m.ttmPrice), tone: 'up' },
    { title: 'Most expensive', hint: '12-month typical price', rows: by((m) => m.ttmPrice, 1), value: (m) => m.ttmPrice!, fmt: (v) => money(v), extra: (m) => pct(m.ttmGrowth), tone: 'neutral' },
    { title: 'Most affordable', hint: '12-month typical price', rows: by((m) => m.ttmPrice, -1), value: (m) => m.ttmPrice!, fmt: (v) => money(v), extra: (m) => pct(m.ttmGrowth), tone: 'neutral' },
    { title: 'Busiest markets', hint: 'Houses sold in the last 12 months', rows: by((m) => m.ttmSales, 1), value: (m) => m.ttmSales, fmt: (v) => num(v) + ' sales', extra: (m) => money(m.ttmPrice), tone: 'neutral' },
  ];

  return (
    <Section
      title="Suburb leaderboards"
      subtitle={<>12 months to {quarterLabel(data.quarters[qi])} · suburbs with {minSales}+ sales in that period ({eligible.length} qualify). Click a suburb to explore it.</>}
    >
      <div className="boards">
        {boards.map((b) => {
          const max = Math.max(...b.rows.map((m) => Math.abs(b.value(m))), 1e-9);
          return (
            <div className="board" key={b.title}>
              <h3>{b.title}</h3>
              <p className="board-hint">{b.hint}</p>
              {b.rows.length === 0 ? <p className="empty">No suburbs qualify.</p> : (
                <ol>
                  {b.rows.map((m, i) => (
                    <li key={m.s.suburb}>
                      <button className="board-row" onClick={() => pick(m.s.suburb)} title={`Explore ${titleCase(m.s.suburb)}`}>
                        <span className="rank">{i + 1}</span>
                        <span className="name">{titleCase(m.s.suburb)}<small>{b.extra(m)}</small></span>
                        <span className={`val ${b.tone}`}>{b.fmt(b.value(m))}</span>
                        <span className={`bar ${b.tone}`} style={{ width: `${(Math.abs(b.value(m)) / max) * 100}%` }} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
