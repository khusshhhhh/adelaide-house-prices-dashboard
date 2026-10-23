import { areaTtm, growth } from '../lib/data';
import { money, num, pct, quarterLabel, titleCase } from '../lib/format';
import type { Ctx } from './ctx';
import { Delta, Info, Sparkline } from './ui';

export function Kpis({ ctx }: { ctx: Ctx }) {
  const { qi, areaSeries: series, metrics, palette, area, data, minSales } = ctx;
  const cur = series[qi];
  const yearAgo = qi >= 4 ? series[qi - 4] : null;
  const prevQ = qi >= 1 ? series[qi - 1] : null;
  const window = series.slice(Math.max(0, qi - 19), qi + 1);

  const ttmNow = areaTtm(area, qi);
  const ttm5 = qi >= 20 ? areaTtm(area, qi - 20) : null;
  const ttm1 = qi >= 4 ? areaTtm(area, qi - 4) : null;

  const ranked = metrics.filter((m) => m.ttmSales >= minSales && m.ttmGrowth != null);
  const rising = ranked.filter((m) => (m.ttmGrowth ?? 0) > 0).length;

  const withMedian = metrics.filter((m) => m.median != null);
  const million = withMedian.filter((m) => m.median! >= 1_000_000).length;
  const million5 = qi >= 20 ? area.filter((s) => (s.median[qi - 20] ?? 0) >= 1_000_000).length : null;
  const with5 = qi >= 20 ? area.filter((s) => s.median[qi - 20] != null).length : null;

  const top = withMedian.filter((m) => (m.sales ?? 0) >= 3).sort((a, b) => b.median! - a.median!)[0];
  const records = withMedian.filter((m) => m.isRecord && (m.sales ?? 0) >= 3).length;

  return (
    <div className="kpis">
      <div className="kpi feature">
        <div className="kpi-label">Typical house price · {quarterLabel(data.quarters[qi])}
          <Info text="Sales-weighted average of every suburb's quarterly median sale price. Suburbs with more sales count for more, so this tracks the price of a typical house sold in the area." />
        </div>
        <div className="kpi-value">{money(cur.price)}</div>
        <div className="kpi-deltas">
          <Delta value={growth(cur.price, yearAgo?.price)} label="vs year ago" />
          <Delta value={growth(cur.price, prevQ?.price)} label="vs last qtr" />
        </div>
        <Sparkline values={window.map((p) => p.price)} color={palette.series[0]} />
      </div>

      <div className="kpi">
        <div className="kpi-label">Houses sold this quarter
          <Info text="Number of house sales recorded by the Valuer-General across the area's suburbs in the quarter. Recent quarters may still rise slightly as late settlements are lodged." />
        </div>
        <div className="kpi-value">{num(cur.sales)}</div>
        <div className="kpi-deltas"><Delta value={growth(cur.sales, yearAgo?.sales)} label="vs a year ago" /></div>
        <Sparkline values={window.map((p) => p.sales)} color={palette.series[0]} />
      </div>

      <div className="kpi">
        <div className="kpi-label">12-month typical price
          <Info text="Sales-weighted price over the last four quarters. Smoother than a single quarter, so it's the better gauge of the trend." />
        </div>
        <div className="kpi-value">{money(ttmNow?.price)}</div>
        <div className="kpi-deltas">
          <Delta value={growth(ttmNow?.price, ttm1?.price)} label="1 yr" />
          <Delta value={growth(ttmNow?.price, ttm5?.price)} label="5 yrs" />
        </div>
      </div>

      <div className="kpi">
        <div className="kpi-label">Suburbs with rising prices
          <Info text={`Share of suburbs (with ${minSales}+ sales in the last 12 months) whose 12-month typical price is higher than a year earlier.`} />
        </div>
        <div className="kpi-value">{ranked.length ? pct(rising / ranked.length, 0, false) : '–'}</div>
        <div className="kpi-foot">{rising} of {ranked.length} suburbs up over 12 months</div>
        <div className="meter" aria-hidden="true"><span style={{ width: `${ranked.length ? (rising / ranked.length) * 100 : 0}%` }} /></div>
      </div>

      <div className="kpi">
        <div className="kpi-label">$1M+ suburbs
          <Info text="Suburbs whose median house price in the selected quarter was $1 million or more." />
        </div>
        <div className="kpi-value">{million}<span className="kpi-unit"> of {withMedian.length}</span></div>
        <div className="kpi-foot">{million5 != null ? <>vs {million5} of {with5} five years earlier</> : 'Share of suburbs with sales'}</div>
        <div className="meter" aria-hidden="true"><span style={{ width: `${withMedian.length ? (million / withMedian.length) * 100 : 0}%` }} /></div>
      </div>

      <div className="kpi">
        <div className="kpi-label">Priciest suburb this quarter
          <Info text="Highest quarterly median among suburbs with at least 3 sales in the quarter." />
        </div>
        <div className="kpi-value small">{top ? titleCase(top.s.suburb) : '–'}</div>
        <div className="kpi-foot">{top ? <>{money(top.median, false)} · {top.sales} sales</> : null}</div>
        <div className="kpi-foot muted">{records} suburb{records === 1 ? '' : 's'} set a record median this quarter</div>
      </div>
    </div>
  );
}
