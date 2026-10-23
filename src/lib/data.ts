export interface RawSuburb {
  suburb: string;
  council: string;
  councils: string[];
  postcode: string | null;
  sales: (number | null)[];
  median: (number | null)[];
}

export interface RawData {
  generatedAt: string;
  datasetModified: string;
  source: { name: string; url: string; organisation: string | null; license: string | null };
  latestQuarter: string;
  publishedQuarters: string[];
  quarters: string[];
  councils: string[];
  suburbs: RawSuburb[];
}

export async function loadData(): Promise<RawData> {
  const res = await fetch('/data/sales.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load data (HTTP ${res.status})`);
  return res.json();
}

export const growth = (now: number | null | undefined, then: number | null | undefined) =>
  now != null && then != null && then > 0 ? now / then - 1 : null;

export const cagr = (now: number | null, then: number | null, years: number) =>
  now != null && then != null && then > 0 ? Math.pow(now / then, 1 / years) - 1 : null;

/** Sales-weighted average of the medians of a set of (sales, median) pairs. */
function weighted(pairs: Iterable<[number | null, number | null]>) {
  let sales = 0, value = 0;
  for (const [s, m] of pairs) {
    if (s && m) { sales += s; value += s * m; }
  }
  return sales > 0 ? { price: value / sales, sales } : null;
}

/** Trailing-12-month price for one suburb: sales-weighted mean of its last four quarterly medians. */
export function ttm(s: RawSuburb, qi: number) {
  const pairs: [number | null, number | null][] = [];
  for (let i = Math.max(0, qi - 3); i <= qi; i++) pairs.push([s.sales[i], s.median[i]]);
  return weighted(pairs);
}

export interface AreaPoint {
  /** Sales-weighted mean of suburb medians for the quarter. */
  price: number | null;
  /** Median of the suburb medians (each suburb counts once). */
  medianOfMedians: number | null;
  sales: number;
  suburbs: number;
}

export function areaSeries(suburbs: RawSuburb[], nQuarters: number): AreaPoint[] {
  const out: AreaPoint[] = [];
  for (let qi = 0; qi < nQuarters; qi++) {
    const w = weighted(suburbs.map((s) => [s.sales[qi], s.median[qi]] as [number | null, number | null]));
    const meds = suburbs.map((s) => s.median[qi]).filter((m): m is number => m != null);
    let total = 0;
    for (const s of suburbs) total += s.sales[qi] ?? 0;
    out.push({ price: w?.price ?? null, medianOfMedians: median(meds), sales: total, suburbs: meds.length });
  }
  return out;
}

/** Area price over the trailing 4 quarters (sales-weighted across every suburb-quarter). */
export function areaTtm(suburbs: RawSuburb[], qi: number) {
  const pairs: [number | null, number | null][] = [];
  for (const s of suburbs) for (let i = Math.max(0, qi - 3); i <= qi; i++) pairs.push([s.sales[i], s.median[i]]);
  return weighted(pairs);
}

export function median(xs: number[]) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export interface SuburbMetrics {
  s: RawSuburb;
  median: number | null;
  sales: number | null;
  qoq: number | null;
  yoy: number | null;
  ttmPrice: number | null;
  ttmSales: number;
  ttmGrowth: number | null;
  growth5y: number | null;
  cagr10y: number | null;
  peak: number | null;
  peakQi: number | null;
  isRecord: boolean;
}

export function suburbMetrics(s: RawSuburb, qi: number): SuburbMetrics {
  const t = ttm(s, qi);
  const t1 = qi >= 4 ? ttm(s, qi - 4) : null;
  const t5 = qi >= 20 ? ttm(s, qi - 20) : null;
  const t10 = qi >= 40 ? ttm(s, qi - 40) : null;
  let peak: number | null = null, peakQi: number | null = null;
  for (let i = 0; i <= qi; i++) {
    const m = s.median[i];
    if (m != null && (peak == null || m >= peak)) { peak = m; peakQi = i; }
  }
  return {
    s,
    median: s.median[qi],
    sales: s.sales[qi],
    qoq: qi >= 1 ? growth(s.median[qi], s.median[qi - 1]) : null,
    yoy: qi >= 4 ? growth(s.median[qi], s.median[qi - 4]) : null,
    ttmPrice: t?.price ?? null,
    ttmSales: t?.sales ?? 0,
    ttmGrowth: growth(t?.price, t1?.price),
    growth5y: growth(t?.price, t5?.price),
    cagr10y: cagr(t?.price ?? null, t10?.price ?? null, 10),
    peak,
    peakQi,
    isRecord: s.median[qi] != null && peakQi === qi && qi > 0,
  };
}

export const PRICE_BANDS = [
  { label: 'Under $400k', max: 400_000 },
  { label: '$400–600k', max: 600_000 },
  { label: '$600–800k', max: 800_000 },
  { label: '$800k–1M', max: 1_000_000 },
  { label: '$1–1.5M', max: 1_500_000 },
  { label: '$1.5–2M', max: 2_000_000 },
  { label: '$2M+', max: Infinity },
];

export const bandOf = (price: number) => PRICE_BANDS.findIndex((b) => price < b.max);

export const inCouncil = (s: RawSuburb, council: string) => council === 'ALL' || s.councils.includes(council);
