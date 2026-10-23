import type { ReactNode } from 'react';
import { deltaClass, pct } from '../lib/format';

export function Section({ id, title, subtitle, actions, children, className = '' }: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Delta({ value, label, digits = 1 }: { value: number | null | undefined; label?: string; digits?: number }) {
  const cls = deltaClass(value);
  const arrow = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '■';
  return (
    <span className={`delta ${cls}`}>
      {value == null ? '–' : <><span aria-hidden="true">{arrow}</span> {pct(value, digits)}</>}
      {label && <span className="delta-label"> {label}</span>}
    </span>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Minimal inline sparkline; values may contain gaps. */
export function Sparkline({ values, color, highlightLast = true }: { values: (number | null)[]; color: string; highlightLast?: boolean }) {
  const w = 120, h = 34, pad = 3;
  const vals = values.map((v, i) => [i, v] as const).filter(([, v]) => v != null) as [number, number][];
  if (vals.length < 2) return null;
  const ys = vals.map(([, v]) => v);
  const min = Math.min(...ys), max = Math.max(...ys);
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const d = vals.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const [li, lv] = vals[vals.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {highlightLast && <circle cx={x(li)} cy={y(lv)} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />}
    </svg>
  );
}

export function Info({ text }: { text: string }) {
  return <span className="info" tabIndex={0} aria-label={text} data-tip={text}>i</span>;
}

export const pctOrDash = pct;
