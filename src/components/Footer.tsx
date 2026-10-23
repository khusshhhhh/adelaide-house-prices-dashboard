import type { RawData } from '../lib/data';
import { quarterLabel } from '../lib/format';

export function Footer({ data }: { data: RawData }) {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <h3>About the data</h3>
          <p>
            Source: <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a>
            {data.source.organisation && <> — {data.source.organisation}</>}
            {data.source.license && <>, licensed {data.source.license}</>}. Figures are the median sale price and number of house sales
            recorded by the Valuer-General for each metropolitan suburb, published quarterly ({data.publishedQuarters.length} releases,{' '}
            {quarterLabel(data.publishedQuarters[0])} – {quarterLabel(data.publishedQuarters[data.publishedQuarters.length - 1])}).
          </p>
        </div>
        <div>
          <h3>How it's calculated</h3>
          <ul>
            <li><b>Typical price</b> is a sales-weighted average of suburb medians — not an official metro median, which isn't published in this dataset.</li>
            <li><b>12-month price</b> weights each of the last four quarterly medians by its sales, smoothing out small-sample noise.</li>
            <li>Each release also restates the same quarter a year earlier; those later, more complete figures are used where available.</li>
            <li>Suburbs crossing council boundaries are counted in every council they touch.</li>
          </ul>
        </div>
        <div>
          <h3>Always up to date</h3>
          <p>
            A scheduled job checks data.sa.gov.au every week for new or revised releases, rebuilds the dataset and redeploys this site automatically.
            Last refreshed {new Date(data.generatedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
          <p><a href="/data/adelaide-median-house-sales.csv" download>Download the full dataset (CSV)</a></p>
        </div>
      </div>
    </footer>
  );
}
