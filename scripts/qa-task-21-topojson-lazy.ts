import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium, type Browser, type Page } from '/tmp/opencode/pw21/node_modules/playwright-core';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3121';
const BUILD_DIR = process.env.QA_BUILD_DIR ?? '.next';
const EXECUTABLE =
  '/home/juanitolillig/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell';

const EVIDENCE_TXT = '.sisyphus/evidence/task-21-topojson-lazy.txt';
const ATLAS_FILE = 'public/data/countries-110m.json';
const ATLAS_PATH = '/data/countries-110m.json';
const SIZE_BUDGET_KB = 150;

const lines: string[] = [];
const failures: string[] = [];

function out(line = ''): void {
  lines.push(line);
  console.log(line);
}

function check(label: string, passed: boolean, detail: string): void {
  out(`${passed ? 'PASS' : 'FAIL'}  ${label} — ${detail}`);
  if (!passed) {
    failures.push(label);
  }
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

async function recordRequests(page: Page, path: string): Promise<string[]> {
  const requests: string[] = [];
  const collect = (url: string): void => {
    requests.push(url.replace(BASE, ''));
  };

  page.on('request', (request) => collect(request.url()));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  page.removeAllListeners('request');

  return requests;
}

out('QA Scenario 2: TopoJSON is fetched, never bundled');
out('='.repeat(78));
out();
out(`Date:      ${new Date().toISOString()}`);
out(`Build dir: ${BUILD_DIR}`);
out(`Base URL:  ${BASE}`);
out('Browser:   chrome-headless-shell 1208 via playwright-core');
out();

out('Step 0: the atlas asset itself');
out('-'.repeat(78));
const atlasBytes = statSync(ATLAS_FILE).size;
const atlasKb = atlasBytes / 1024;
out(`  ${ATLAS_FILE} — ${atlasKb.toFixed(1)} KB`);
check(
  `${ATLAS_FILE} exists and is under ${SIZE_BUDGET_KB} KB`,
  atlasKb < SIZE_BUDGET_KB,
  `${atlasKb.toFixed(1)} KB (110m scale; 50m is 738 KB, 10m is 3.5 MB)`
);

const scales = readdirSync('public/data');
check(
  'No larger Natural Earth scale was shipped',
  !scales.includes('countries-50m.json') && !scales.includes('countries-10m.json'),
  `public/data contains: ${scales.join(', ')}`
);
out();

out('Step 1-2: production JS chunk inventory and payload grep');
out('-'.repeat(78));

const chunkDir = join(BUILD_DIR, 'static');
const chunks = walk(chunkDir).filter((file) => file.endsWith('.js'));

const contaminated: string[] = [];
const urlCarriers: string[] = [];
for (const chunk of chunks) {
  const text = await Bun.file(chunk).text();
  if (text.includes('"type":"Topology"') || text.includes('"arcs":[[[')) {
    contaminated.push(relative(BUILD_DIR, chunk));
  }
  if (text.includes(ATLAS_PATH)) {
    urlCarriers.push(relative(BUILD_DIR, chunk));
  }
}

const biggest = chunks
  .map((file) => ({ file: relative(BUILD_DIR, file), kb: statSync(file).size / 1024 }))
  .sort((a, b) => b.kb - a.kb)
  .slice(0, 8);

for (const entry of biggest) {
  out(`  ${entry.kb.toFixed(1).padStart(8)} KB  ${entry.file}`);
}
out(`  ... ${chunks.length} JS files scanned in total`);
out();

check(
  'Step 2 — no chunk contains a TopoJSON payload',
  contaminated.length === 0,
  contaminated.length === 0
    ? `${chunks.length} chunks scanned, all clean`
    : `contaminated: ${contaminated.join(', ')}`
);
check(
  'Only the lazy map chunk carries the atlas URL, and it carries the URL alone',
  urlCarriers.length === 1,
  `${urlCarriers.join(', ') || 'none'} — a string, not 108 KB of geometry`
);
out();

out('Step 3: navigate to "/" — a route with no map');
out('-'.repeat(78));

let browser: Browser | undefined;

try {
  browser = await chromium.launch({ executablePath: EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();

  const homeRequests = await recordRequests(page, '/');
  for (const request of homeRequests) {
    out(`  ${request}`);
  }
  out();
  check(
    'Step 3 — "/" never requests the atlas',
    !homeRequests.some((url) => url.includes('countries-110m')),
    `${homeRequests.length} requests, none for the atlas`
  );
  out();

  out('Step 4: navigate to "/qa/map" — the route that shows the chart');
  out('-'.repeat(78));

  const mapRequests = await recordRequests(page, '/qa/map');
  for (const request of mapRequests) {
    out(`  ${request}`);
  }
  out();

  const atlasRequests = mapRequests.filter((url) => url.includes('countries-110m'));
  check(
    `Step 4 — "/qa/map" requests ${ATLAS_PATH} at runtime`,
    atlasRequests.length === 1,
    atlasRequests.length === 1
      ? `exactly one fetch: ${atlasRequests[0]}`
      : `${atlasRequests.length} atlas requests`
  );
  check(
    'The chart rendered from that fetch',
    (await page.getAttribute('[data-testid="antique-world-map"]', 'data-map-state')) === 'ready',
    `data-country-count=${await page.getAttribute('[data-testid="antique-world-map"]', 'data-country-count')}`
  );

  await context.close();
} finally {
  await browser?.close();
}

out();
out('='.repeat(78));
out(failures.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL — ${failures.join('; ')}`);

await Bun.write(EVIDENCE_TXT, `${lines.join('\n')}\n`);

process.exit(failures.length === 0 ? 0 : 1);
