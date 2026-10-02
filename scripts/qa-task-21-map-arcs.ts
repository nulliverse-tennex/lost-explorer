import { chromium, type Browser, type Page } from '/tmp/opencode/pw21/node_modules/playwright-core';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3121';
const EXECUTABLE =
  '/home/juanitolillig/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell';

const EVIDENCE_PNG = '.sisyphus/evidence/task-21-map-arcs.png';
const EVIDENCE_TXT = '.sisyphus/evidence/task-21-map-arcs.txt';
const SHOT_TBILISI = '/tmp/opencode/pw21/tbilisi.png';
const SHOT_DATELINE = '/tmp/opencode/pw21/dateline.png';

const TBILISI = 'Tbilisi,41.72,44.83';
const THREE_WRONG = 'Paris,48.86,2.35|Cairo,30.04,31.24|Delhi,28.61,77.21';
const ANCHORAGE = 'Anchorage,61.22,-149.90';
const KAMCHATKA = 'Petropavlovsk-Kamchatsky,53.02,158.65';

const lines: string[] = [];
const failures: string[] = [];
const consoleErrors: string[] = [];

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

interface ArcReport {
  countryPaths: number;
  totalPaths: number;
  dashedArcs: number;
  routeGroups: number;
  commandCounts: number[];
  arcWidths: number[];
  widestFraction: number;
  viewportWidth: number;
  mapState: string;
  trueMarker: boolean;
  wrongMarkers: number;
  description: string;
  oceanPattern: boolean;
}

function readMap(page: Page): Promise<ArcReport> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="antique-world-map"]');
    if (svg === null) {
      throw new Error('map svg missing');
    }

    const arcs = Array.from(svg.querySelectorAll<SVGPathElement>('[data-testid="route-arc"]'));
    const dashed = arcs.filter((arc) => {
      const dash = getComputedStyle(arc).strokeDasharray;
      return dash !== '' && dash !== 'none';
    });

    const viewportWidth = svg.getBoundingClientRect().width;
    const arcWidths = dashed.map((arc) => arc.getBoundingClientRect().width);

    return {
      countryPaths: svg.querySelectorAll('[data-country]').length,
      totalPaths: svg.querySelectorAll('path').length,
      dashedArcs: dashed.length,
      routeGroups: svg.querySelectorAll('[data-testid="route"]').length,
      commandCounts: dashed.map(
        (arc) => (arc.getAttribute('d') ?? '').match(/[MLC]/g)?.length ?? 0
      ),
      arcWidths,
      widestFraction: arcWidths.length === 0 ? 1 : Math.max(...arcWidths) / viewportWidth,
      viewportWidth,
      mapState: svg.getAttribute('data-map-state') ?? '',
      trueMarker: svg.querySelector('[data-testid="true-city-marker"]') !== null,
      wrongMarkers: svg.querySelectorAll('[data-testid="wrong-guess-marker"]').length,
      description: svg.querySelector('desc')?.textContent ?? '',
      oceanPattern: svg.querySelector('defs pattern circle') !== null,
    };
  });
}

async function render(page: Page, trueCity: string, wrong: string): Promise<ArcReport> {
  const query = `true=${encodeURIComponent(trueCity)}&wrong=${encodeURIComponent(wrong)}`;
  await page.goto(`${BASE}/qa/map?${query}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-map-state="ready"]', { timeout: 20000 });
  return readMap(page);
}

async function asDataUri(path: string): Promise<string> {
  const bytes = await Bun.file(path).arrayBuffer();
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

async function combine(browser: Browser, captions: [string, string]): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1320, height: 1720 } });
  const [first, second] = captions;
  await page.setContent(`
    <body style="margin:0;background:#f0e6d2;font:14px 'Courier New',monospace;color:#1c1814">
      <p style="margin:14px 20px 4px;letter-spacing:.14em;text-transform:uppercase">${first}</p>
      <img src="${await asDataUri(SHOT_TBILISI)}" style="display:block;width:1280px">
      <p style="margin:18px 20px 4px;letter-spacing:.14em;text-transform:uppercase">${second}</p>
      <img src="${await asDataUri(SHOT_DATELINE)}" style="display:block;width:1280px">
    </body>
  `);
  await page.waitForLoadState('load');
  await page.screenshot({ path: EVIDENCE_PNG, fullPage: true });
  await page.close();
}

out('QA Scenario 1: Map renders with curved arcs and survives the antimeridian');
out('='.repeat(78));
out();
out(`Date:     ${new Date().toISOString()}`);
out(`Base URL: ${BASE} (next start, production build)`);
out('Browser:  chrome-headless-shell 1208 via playwright-core');
out();

let browser: Browser | undefined;

try {
  browser = await chromium.launch({ executablePath: EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });

  out('Steps 1-4: Tbilisi (41.72, 44.83) vs Paris, Cairo, Delhi');
  out('-'.repeat(78));
  const tbilisi = await render(page, TBILISI, THREE_WRONG);
  await page.screenshot({ path: SHOT_TBILISI });

  out(`  map state ............. ${tbilisi.mapState}`);
  out(`  country outlines ...... ${tbilisi.countryPaths}`);
  out(`  total <path> elements . ${tbilisi.totalPaths}`);
  out(`  route groups .......... ${tbilisi.routeGroups}`);
  out(`  dashed arc paths ...... ${tbilisi.dashedArcs}`);
  out(`  arc command counts .... ${tbilisi.commandCounts.join(', ')}`);
  out(`  true-city station mark  ${tbilisi.trueMarker ? 'present' : 'absent'}`);
  out(`  wrong-guess marks ..... ${tbilisi.wrongMarkers}`);
  out(`  stipple ocean pattern . ${tbilisi.oceanPattern ? 'present' : 'absent'}`);
  out(`  accessible desc ....... ${tbilisi.description}`);
  out();

  check(
    'Step 2 — SVG contains more than 100 <path> elements',
    tbilisi.totalPaths > 100,
    `${tbilisi.totalPaths} paths, ${tbilisi.countryPaths} of them country outlines`
  );
  check(
    'Step 3 — exactly 3 dashed arc paths, one per wrong guess',
    tbilisi.dashedArcs === 3 && tbilisi.routeGroups === 3,
    `${tbilisi.dashedArcs} dashed arcs across ${tbilisi.routeGroups} route groups`
  );
  check(
    'Step 4 — every arc "d" has more than 2 coordinate commands',
    Math.min(...tbilisi.commandCounts) > 2,
    `fewest on any arc: ${Math.min(...tbilisi.commandCounts)} (a straight chord would be 2)`
  );
  check(
    'True city is marked distinctly from the wrong guesses',
    tbilisi.trueMarker && tbilisi.wrongMarkers === 3,
    `1 station mark + ${tbilisi.wrongMarkers} crossed rings`
  );
  check(
    'Ocean is filled with a vector stipple pattern',
    tbilisi.oceanPattern,
    'defs > pattern > circle present'
  );
  out();

  out('Steps 5-6: Anchorage (61.22, -149.90) vs Petropavlovsk-Kamchatsky (53.02, 158.65)');
  out('-'.repeat(78));
  const dateline = await render(page, ANCHORAGE, KAMCHATKA);
  await page.screenshot({ path: SHOT_DATELINE });

  out(`  map state ............. ${dateline.mapState}`);
  out(`  route groups .......... ${dateline.routeGroups}`);
  out(`  dashed arc paths ...... ${dateline.dashedArcs}`);
  out(`  arc command counts .... ${dateline.commandCounts.join(', ')}`);
  out(`  SVG viewport width .... ${dateline.viewportWidth.toFixed(1)} px`);
  out(`  arc rendered widths ... ${dateline.arcWidths.map((w) => `${w.toFixed(1)} px`).join(', ')}`);
  out(`  widest arc fraction ... ${(dateline.widestFraction * 100).toFixed(1)}% of viewport`);
  out(`  accessible desc ....... ${dateline.description}`);
  out();

  check(
    'Step 6 — widest dateline arc spans under 60% of the SVG viewport width',
    dateline.widestFraction < 0.6,
    `${(dateline.widestFraction * 100).toFixed(1)}% — a smeared antimeridian would approach 100%`
  );
  check(
    'Dateline route is cut into two edge-to-edge strokes, not one wrapping line',
    dateline.routeGroups === 1 && dateline.dashedArcs === 2,
    `${dateline.dashedArcs} strokes in ${dateline.routeGroups} route group`
  );
  check(
    'Dateline strokes are adaptively sampled as well',
    Math.min(...dateline.commandCounts) > 2,
    `fewest commands: ${Math.min(...dateline.commandCounts)}`
  );
  check(
    'No console errors across either render',
    consoleErrors.length === 0,
    consoleErrors.length === 0 ? 'clean' : consoleErrors.join(' | ')
  );

  await context.close();
  await combine(browser, [
    'Render A — Tbilisi vs Paris, Cairo, Delhi (three dashed great-circle arcs)',
    'Render B — Anchorage vs Petropavlovsk-Kamchatsky (dateline pair, no smear)',
  ]);
} finally {
  await browser?.close();
}

out();
out('='.repeat(78));
out(`Screenshots: ${EVIDENCE_PNG} (both renders stacked)`);
out(failures.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL — ${failures.join('; ')}`);

await Bun.write(EVIDENCE_TXT, `${lines.join('\n')}\n`);

process.exit(failures.length === 0 ? 0 : 1);
