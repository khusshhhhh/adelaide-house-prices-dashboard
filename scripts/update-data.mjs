// Pulls every "Metropolitan Median House Sales" quarterly file from the SA Government
// open data portal (CKAN API), caches the raw files, and builds the compact JSON + CSV
// the dashboard reads. Safe to run repeatedly: only new or modified files are downloaded.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const MANIFEST = path.join(ROOT, 'data', 'manifest.json');
const OUT_DIR = path.join(ROOT, 'public', 'data');

const DATASET_ID = 'metro-median-house-sales';
const API = `https://data.sa.gov.au/data/api/3/action/package_show?id=${DATASET_ID}`;
const DATASET_URL = `https://data.sa.gov.au/data/dataset/${DATASET_ID}`;

// The source abbreviates some council names in older files.
const COUNCIL_ALIASES = {
  'NORWD PAYNM ST PET': 'NORWOOD PAYNEHAM & ST PETERS',
  'PORT ADEL ENFIELD': 'PORT ADELAIDE ENFIELD',
};

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
// Older files write "ST.GEORGES"; newer ones "ST GEORGES".
const normSuburb = (s) => norm(s).replace(/\bST\.\s*/g, 'ST ');
const qKey = (q, y) => `${y}-Q${q}`;
const qIndex = (key) => {
  const [y, q] = key.split('-Q').map(Number);
  return y * 4 + (q - 1);
};
const qFromIndex = (i) => qKey((i % 4) + 1, Math.floor(i / 4));

function cellValue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    return null;
  }
  return v;
}

function toNumber(v) {
  v = cellValue(v);
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$,\s]/g, '');
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Parses "Sales 3Q 2026" / "Median\n1Q 2015" style headers into a quarter key.
function headerQuarter(h) {
  const m = String(cellValue(h) ?? '').replace(/\s+/g, ' ').match(/(\d)Q\s*(\d{4})/i);
  return m ? qKey(Number(m[1]), Number(m[2])) : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function readRows(file) {
  const buf = await fs.readFile(file);
  // Some resources are labelled CSV but are really xlsx (and vice versa): sniff the zip header.
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (r) => rows.push(r.values.slice(1)));
    return rows;
  }
  return parseCsv(buf.toString('utf8').replace(/^﻿/, ''));
}

// Returns { current, previous, rows: [{council, suburb, prev:{sales,median}, cur:{sales,median}}] }
async function parseFile(file) {
  const rows = await readRows(file);
  const hi = rows.findIndex((r) => norm(cellValue(r[0])) === 'CITY' && norm(cellValue(r[1])) === 'SUBURB');
  if (hi < 0) throw new Error(`No header row in ${path.basename(file)}`);
  const header = rows[hi];
  const previous = headerQuarter(header[2]);
  const current = headerQuarter(header[4]);
  if (!previous || !current) throw new Error(`Unrecognised header in ${path.basename(file)}: ${header}`);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const council = norm(cellValue(r[0]));
    const suburb = normSuburb(cellValue(r[1]));
    if (!council || !suburb) continue;
    out.push({
      council: COUNCIL_ALIASES[council] ?? council,
      suburb,
      prev: { sales: toNumber(r[2]), median: toNumber(r[3]) },
      cur: { sales: toNumber(r[4]), median: toNumber(r[5]) },
    });
  }
  return { current, previous, rows: out };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'adelaide-house-sales-dashboard' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) {
      if (attempt === 3) throw new Error(`Download failed for ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function syncRawFiles() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  const manifest = await readJson(MANIFEST, { resources: {} });
  const res = await fetch(API);
  if (!res.ok) throw new Error(`CKAN API returned HTTP ${res.status}`);
  const pkg = (await res.json()).result;

  let downloaded = 0;
  const files = [];
  for (const r of pkg.resources) {
    const m = r.name.match(/Q([1-4])\s*(\d{4})/i);
    if (!m) { console.warn(`Skipping unrecognised resource: ${r.name}`); continue; }
    const ext = (r.url.split('?')[0].split('.').pop() || 'xlsx').toLowerCase();
    const fileName = `Q${m[1]}_${m[2]}.${ext}`;
    const dest = path.join(RAW_DIR, fileName);
    const stamp = r.last_modified || r.metadata_modified || r.created;
    const known = manifest.resources[r.id];
    const exists = await fs.access(dest).then(() => true, () => false);
    if (!exists || !known || known.modified !== stamp) {
      console.log(`↓ ${r.name}`);
      await download(r.url, dest);
      downloaded++;
    }
    manifest.resources[r.id] = { name: r.name, file: fileName, url: r.url, modified: stamp };
    files.push({ file: dest, name: r.name, modified: stamp });
  }
  manifest.datasetModified = pkg.metadata_modified;
  return { manifest, files, downloaded, pkg };
}

const round = (n) => (n == null ? null : Math.round(n));

async function build() {
  const { manifest, files, downloaded, pkg } = await syncRawFiles();
  console.log(`${files.length} resources, ${downloaded} downloaded`);

  // Suburbs that straddle council boundaries are listed once per council with identical
  // figures, so a suburb is the unit of data and councils are a many-to-many attribute.
  // values[suburb][quarter] = { sales, median, revised }
  const values = new Map();
  const councilsOf = new Map(); // suburb -> Map(council -> files where it was the only council listed)
  const fileQuarters = [];
  const set = (suburb, q, v, revised) => {
    if (v.sales == null && v.median == null) return;
    if (!values.has(suburb)) values.set(suburb, {});
    const slot = values.get(suburb);
    // Revised figures (published a year later as the comparison column) are more complete,
    // so they win over the first-release figure for the same quarter.
    if (!slot[q] || (revised && !slot[q].revised)) slot[q] = { ...v, revised };
  };

  for (const f of files) {
    const parsed = await parseFile(f.file);
    fileQuarters.push(parsed.current);
    const listings = new Map();
    for (const r of parsed.rows) {
      if (!listings.has(r.suburb)) listings.set(r.suburb, new Set());
      listings.get(r.suburb).add(r.council);
      set(r.suburb, parsed.current, r.cur, false);
      set(r.suburb, parsed.previous, r.prev, true);
    }
    for (const [suburb, cs] of listings) {
      if (!councilsOf.has(suburb)) councilsOf.set(suburb, new Map());
      const m = councilsOf.get(suburb);
      for (const c of cs) m.set(c, (m.get(c) ?? 0) + (cs.size === 1 ? 1 : 0));
    }
  }

  const allQ = [...new Set([...values.values()].flatMap((v) => Object.keys(v)))].map(qIndex);
  const first = Math.min(...allQ), last = Math.max(...allQ);
  const quarters = [];
  for (let i = first; i <= last; i++) quarters.push(qFromIndex(i));

  const postcodes = await readJson(path.join(ROOT, 'data', 'postcodes.json'), {});
  const suburbs = [...values.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((suburb) => {
      const v = values.get(suburb);
      // Primary council: the one it is most often listed under on its own; ties go alphabetical.
      const councils = [...councilsOf.get(suburb).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
      return {
        suburb,
        council: councils[0],
        councils,
        postcode: postcodes[suburb] ?? null,
        sales: quarters.map((q) => v[q]?.sales ?? null),
        median: quarters.map((q) => round(v[q]?.median)),
      };
    })
    .filter((s) => s.median.some((m) => m != null));

  const councils = [...new Set(suburbs.flatMap((s) => s.councils))].sort();
  const latest = quarters[quarters.length - 1];
  const data = {
    generatedAt: new Date().toISOString(),
    source: { name: pkg.title, url: DATASET_URL, organisation: pkg.organization?.title ?? null, license: pkg.license_title ?? null },
    datasetModified: pkg.metadata_modified,
    latestQuarter: latest,
    publishedQuarters: [...new Set(fileQuarters)].sort((a, b) => qIndex(a) - qIndex(b)),
    quarters,
    councils,
    suburbs,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const prev = await readJson(path.join(OUT_DIR, 'sales.json'), null);
  const changed = !prev || JSON.stringify({ ...prev, generatedAt: 0, datasetModified: 0 }) !== JSON.stringify({ ...data, generatedAt: 0, datasetModified: 0 });
  if (!changed) data.generatedAt = prev.generatedAt;

  await fs.writeFile(path.join(OUT_DIR, 'sales.json'), JSON.stringify(data));

  const csv = ['quarter,suburb,postcode,primary_council,all_councils,sales,median_price'];
  for (const s of suburbs) {
    quarters.forEach((q, i) => {
      if (s.sales[i] == null && s.median[i] == null) return;
      csv.push([q, `"${s.suburb}"`, s.postcode ?? '', `"${s.council}"`, `"${s.councils.join('; ')}"`, s.sales[i] ?? '', s.median[i] ?? ''].join(','));
    });
  }
  await fs.writeFile(path.join(OUT_DIR, 'adelaide-median-house-sales.csv'), csv.join('\n') + '\n');
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`${suburbs.length} suburbs · ${councils.length} councils · ${quarters[0]} → ${latest} · ${changed ? 'DATA CHANGED' : 'no data change'}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
