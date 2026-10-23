const SMALL_WORDS = new Set(['and', 'of']);

/** "NORWOOD PAYNEHAM & ST PETERS" → "Norwood Payneham & St Peters", "MCLAREN VALE" → "McLaren Vale". */
export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      let out = w.replace(/(^|[-'])([a-z])/g, (_, p, c) => p + c.toUpperCase());
      out = out.replace(/^Mc([a-z])/, (_, c) => 'Mc' + c.toUpperCase());
      return out;
    })
    .join(' ');
}

export const quarterLabel = (q: string) => {
  const [y, n] = q.split('-Q');
  return `Q${n} ${y}`;
};

const MONTHS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
export const quarterMonths = (q: string) => {
  const [y, n] = q.split('-Q');
  return `${MONTHS[Number(n) - 1]} ${y}`;
};

export function money(n: number | null | undefined, compact = true) {
  if (n == null || !Number.isFinite(n)) return '–';
  if (!compact) return '$' + Math.round(n).toLocaleString('en-AU');
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
  return '$' + Math.round(n);
}

export function pct(n: number | null | undefined, digits = 1, signed = true) {
  if (n == null || !Number.isFinite(n)) return '–';
  const v = (n * 100).toFixed(digits);
  return (signed && n > 0 ? '+' : '') + v + '%';
}

export const num = (n: number | null | undefined) => (n == null ? '–' : Math.round(n).toLocaleString('en-AU'));

export const deltaClass = (n: number | null | undefined) => (n == null ? 'flat' : n > 0.0005 ? 'up' : n < -0.0005 ? 'down' : 'flat');
