// One-off: builds the simplified suburb boundary file used by the map, plus a suburb → postcode
// lookup, from the SA Government "Suburbs and Localities" GeoJSON
// (https://data.sa.gov.au/data/dataset/suburb-boundaries). Boundaries rarely change, so the
// output is committed and this only needs re-running if new suburbs appear in the sales data.
//
//   node scripts/build-geo.mjs path/to/Suburbs_GDA2020.geojson
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-geo.mjs <Suburbs_GDA2020.geojson>');
  process.exit(1);
}

const sales = JSON.parse(await fs.readFile(path.join(ROOT, 'public', 'data', 'sales.json'), 'utf8'));
const wanted = new Set(sales.suburbs.map((s) => s.suburb));

// Greater Adelaide bounding box keeps same-named country localities out.
const BBOX = [138.4, -35.45, 139.15, -34.45];

const input = JSON.parse(await fs.readFile(src, 'utf8'));
input.features = input.features.filter((f) => {
  const name = String(f.properties.suburb).toUpperCase().trim();
  if (!wanted.has(name)) return false;
  const pt = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.\d+,\s*-?\d+\.\d+/)[0].split(',').map(Number);
  return pt[0] >= BBOX[0] && pt[0] <= BBOX[2] && pt[1] >= BBOX[1] && pt[1] <= BBOX[3];
});

const postcodes = {};
for (const f of input.features) postcodes[String(f.properties.suburb).toUpperCase().trim()] = f.properties.postcode;

const out = await mapshaper.applyCommands(
  '-i in.json -rename-fields name=suburb -filter-fields name -simplify 6% keep-shapes -o out.json precision=0.0001 format=geojson',
  { 'in.json': JSON.stringify(input) },
);

await fs.writeFile(path.join(ROOT, 'public', 'data', 'suburbs.geojson'), out['out.json']);
await fs.writeFile(path.join(ROOT, 'data', 'postcodes.json'), JSON.stringify(postcodes, null, 2) + '\n');

const missing = [...wanted].filter((s) => !postcodes[s]);
console.log(`${input.features.length} boundaries written, ${(out['out.json'].length / 1024).toFixed(0)} KB`);
if (missing.length) console.log(`No boundary for ${missing.length}: ${missing.join(', ')}`);
