# Adelaide Metro House Prices

A self-updating dashboard of median house sale prices and sales volumes for every metropolitan Adelaide suburb, built from the South Australian Government's [Metro median house sales](https://data.sa.gov.au/data/dataset/metro-median-house-sales) open dataset (Valuer-General data, Q1 2014 onward).

## What's in it

- **Headline KPIs**: typical price, sales volume, 12-month price, share of suburbs rising, $1M+ suburbs, record highs
- **Auto-generated insights**: plain-English summary of the selected quarter and area
- **Price and volume trends**: quarterly and smoothed 12-month price, sales per quarter
- **Suburb map**: choropleth of price, 1-year change, 5-year change or sales; click to explore
- **Council comparison**: bar ranking and a year-by-year growth heatmap
- **Price-band distribution**: now vs five years ago, and the mix over time
- **Leaderboards**: biggest rises and falls, best 10-year growth, priciest, most affordable, busiest
- **Market breadth and seasonality**
- **Suburb explorer**: compare up to four suburbs side by side
- **Full sortable table** with CSV export, plus the full long-format dataset as CSV

Filters (quarter, council area, minimum sales for rankings) apply to the whole page. Light and dark themes; `?theme=light` or `?theme=dark` in the URL forces one.

## How it stays up to date

```
data.sa.gov.au (CKAN API) ──► GitHub Action (daily) ──► commit to main ──► Vercel redeploy
```

`.github/workflows/refresh-data.yml` runs every day. It calls the CKAN API, downloads any new or modified quarterly files into `data/raw/`, rebuilds `public/data/sales.json` and the CSV, checks the site still builds, and commits only if the data changed. Vercel's Git integration deploys every push to `main`. No database is needed: the whole dataset is about 300 KB of JSON served as a static file.

## Data notes

- Each quarterly release has the quarter's figures plus the same quarter a year earlier. The later, revised figures are used where available.
- Older files spell some names differently (`ST.GEORGES`, abbreviated council names). These are normalised.
- Suburbs that cross council boundaries appear once per council with identical figures. They're stored once, with all their councils, and counted in each council's totals.
- **Typical price** is a sales-weighted average of suburb medians, not an official metro median (this dataset doesn't publish one). **12-month price** weights the last four quarterly medians by sales.

## Development

```bash
npm install
npm run data     # fetch and rebuild the dataset
npm run dev      # http://localhost:5173
npm run build
```

Suburb boundaries (`public/data/suburbs.geojson`) and postcodes come from the SA Government [Suburbs and Localities](https://data.sa.gov.au/data/dataset/suburb-boundaries) dataset. They rarely change. To rebuild them, download and unzip the GeoJSON and run `npm run geo -- path/to/Suburbs_GDA2020.geojson`.

Stack: Vite, React, TypeScript, ECharts. The data pipeline uses Node and ExcelJS.
