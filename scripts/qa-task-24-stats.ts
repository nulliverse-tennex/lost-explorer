import { chromium, type Browser, type Page } from '/tmp/opencode/pw21/node_modules/playwright-core';

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3124';
const EXECUTABLE =
  '/home/juanitolillig/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell';

const STATS_URL = `${BASE}/qa/stats`;

const EVIDENCE_STATES_PNG = '.sisyphus/evidence/task-24-stats-states.png';
const EVIDENCE_STATES_TXT = '.sisyphus/evidence/task-24-stats-states.txt';
const EVIDENCE_TRANSFER_PNG = '.sisyphus/evidence/task-24-export-import.png';
const EVIDENCE_TRANSFER_TXT = '.sisyphus/evidence/task-24-export-import.txt';

const SHOT_ZERO = '/tmp/opencode/pw24/zero.png';
const SHOT_SEEDED = '/tmp/opencode/pw24/seeded.png';

const EM_DASH = '\u2014';
const FORBIDDEN = /NaN|Infinity|undefined/;

const lines: string[] = [];
const failures: string[] = [];

function out(line = ''): void {
  lines.push(line);
  console.log(line);
}

function check(label: string, passed: boolean, detail: string): void {
  out(`${passed ? 'PASS' : 'FAIL'}  ${label} ${EM_DASH} ${detail}`);
  if (!passed) {
    failures.push(label);
  }
}

type SeedGame = {
  dayKey: string;
  solvedOnDay: number | null;
  solveMs: number;
};

const START_MS = Date.UTC(2026, 5, 10, 9, 0, 0);

// Day keys must be consecutive: computeStats folds the streak from calendar adjacency, so a gap
// here would silently reset currentStreak and make the round-trip assertion meaningless.
const SEED: readonly SeedGame[] = [
  { dayKey: '2026-06-10', solvedOnDay: null, solveMs: 0 },
  { dayKey: '2026-06-11', solvedOnDay: 2, solveMs: 60_000 },
  { dayKey: '2026-06-12', solvedOnDay: 3, solveMs: 120_000 },
  { dayKey: '2026-06-13', solvedOnDay: 3, solveMs: 180_000 },
  { dayKey: '2026-06-14', solvedOnDay: 4, solveMs: 240_000 },
];

function buildJournal(): string {
  const journal: Record<string, unknown> = {};

  SEED.forEach((seed, index) => {
    const startedAtMs = START_MS + index * 86_400_000;
    const won = seed.solvedOnDay !== null;

    const guesses: Record<string, unknown> = won
      ? {
          '1': {
            geonameId: 500 + index,
            displayName: 'Correct City',
            country: 'Testland',
            distanceKm: 0,
            band: 'very-close',
            dayGuessed: seed.solvedOnDay,
          },
        }
      : {
          '1': {
            geonameId: 900 + index,
            displayName: 'Wrong City',
            country: 'Testland',
            distanceKm: 4000,
            band: 'very-far',
            dayGuessed: 5,
          },
        };

    journal[seed.dayKey] = {
      dayKey: seed.dayKey,
      currentDay: won ? seed.solvedOnDay : 5,
      guesses,
      status: won ? 'won' : 'lost',
      startedAtMs,
      resolvedAtMs: startedAtMs + seed.solveMs,
    };
  });

  return JSON.stringify(journal);
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="stats-ready"][data-ready="true"]', {
    timeout: 20_000,
  });
}

async function readCell(page: Page, testId: string): Promise<string> {
  return (await page.locator(`[data-testid="${testId}"]`).innerText()).trim();
}

type Figures = {
  played: string;
  won: string;
  winPercent: string;
  currentStreak: string;
  longestStreak: string;
  failed: string;
  averageDay: string;
  averageSolveTime: string;
};

async function readFigures(page: Page): Promise<Figures> {
  return {
    played: await readCell(page, 'stat-played'),
    won: await readCell(page, 'stat-won'),
    winPercent: await readCell(page, 'stat-win-percent'),
    currentStreak: await readCell(page, 'stat-current-streak'),
    longestStreak: await readCell(page, 'stat-longest-streak'),
    failed: await readCell(page, 'stat-failed'),
    averageDay: await readCell(page, 'stat-average-day'),
    averageSolveTime: await readCell(page, 'stat-average-solve-time'),
  };
}

async function barWidths(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const ids = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'lost'];
    const widths: Record<string, number> = {};
    for (const id of ids) {
      const bar = document.querySelector(`[data-testid="distribution-bar-${id}"]`);
      const fill = bar?.firstElementChild;
      widths[id] = fill instanceof HTMLElement ? fill.getBoundingClientRect().width : -1;
    }
    return widths;
  });
}

async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

async function seedStorage(page: Page, journal: string): Promise<void> {
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem('lx:games', payload);
    localStorage.setItem('lx:meta', JSON.stringify({ _v: 1 }));
  }, journal);
}

async function scenarioStates(page: Page): Promise<Figures> {
  out('Scenario 1: zero state is clean and seeded state is accurate');
  out('-----------------------------------------------------------');

  await page.goto(STATS_URL, { waitUntil: 'domcontentloaded' });
  await clearStorage(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  const zeroText = await page.locator('[data-testid="stats-panel"]').innerText();
  check(
    'zero state has no NaN/Infinity/undefined',
    !FORBIDDEN.test(zeroText),
    FORBIDDEN.test(zeroText)
      ? `matched ${JSON.stringify(FORBIDDEN.exec(zeroText)?.[0])}`
      : 'panel innerText clean'
  );

  const zero = await readFigures(page);
  check(
    'zero state average Day solved renders an em dash',
    zero.averageDay === EM_DASH,
    `rendered ${JSON.stringify(zero.averageDay)}`
  );
  check(
    'zero state played and won read 0',
    zero.played === '0' && zero.won === '0',
    `played=${zero.played} won=${zero.won}`
  );
  check(
    'zero state win rate and streaks read 0',
    zero.winPercent === '0%' && zero.currentStreak === '0' && zero.longestStreak === '0',
    `win=${zero.winPercent} current=${zero.currentStreak} longest=${zero.longestStreak}`
  );
  check(
    'zero state average solve time renders an em dash',
    zero.averageSolveTime === EM_DASH,
    `rendered ${JSON.stringify(zero.averageSolveTime)}`
  );

  const rowCount = await page.locator('[data-testid^="distribution-row-"]').count();
  check(
    'distribution shows five Day rows plus Lost',
    rowCount === 6,
    `${rowCount} rows rendered`
  );

  const zeroWidths = await barWidths(page);
  check(
    'zero state bars all render at zero width',
    Object.values(zeroWidths).every((width) => width === 0),
    JSON.stringify(zeroWidths)
  );

  const heroSize = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="stat-average-day"]');
    const other = document.querySelector('[data-testid="stat-played"]');
    if (!(hero instanceof HTMLElement) || !(other instanceof HTMLElement)) {
      return { hero: 0, other: 0 };
    }
    return {
      hero: Number.parseFloat(getComputedStyle(hero).fontSize),
      other: Number.parseFloat(getComputedStyle(other).fontSize),
    };
  });
  check(
    'average Day solved is the most prominent figure',
    heroSize.hero > heroSize.other,
    `hero ${heroSize.hero}px vs played ${heroSize.other}px`
  );

  await page.screenshot({ path: SHOT_ZERO, fullPage: true });

  await seedStorage(page, buildJournal());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  const seededText = await page.locator('[data-testid="stats-panel"]').innerText();
  check(
    'seeded state has no NaN/Infinity/undefined',
    !FORBIDDEN.test(seededText),
    FORBIDDEN.test(seededText)
      ? `matched ${JSON.stringify(FORBIDDEN.exec(seededText)?.[0])}`
      : 'panel innerText clean'
  );

  const seeded = await readFigures(page);
  check('seeded played reads 5', seeded.played === '5', `played=${seeded.played}`);
  check('seeded won reads 4', seeded.won === '4', `won=${seeded.won}`);
  check('seeded win rate reads 80%', seeded.winPercent === '80%', `win=${seeded.winPercent}`);
  check('seeded failed reads 1', seeded.failed === '1', `failed=${seeded.failed}`);
  check(
    'seeded average Day solved reads 3',
    seeded.averageDay === '3',
    `average=${seeded.averageDay} (mean of 2,3,3,4)`
  );

  const counts = await page.evaluate(() => {
    const ids = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'lost'];
    const result: Record<string, string> = {};
    for (const id of ids) {
      result[id] =
        document.querySelector(`[data-testid="distribution-count-${id}"]`)?.textContent?.trim() ??
        'missing';
    }
    return result;
  });
  check(
    'seeded distribution counts are 0,1,2,1,0 with 1 lost',
    counts['day-1'] === '0' &&
      counts['day-2'] === '1' &&
      counts['day-3'] === '2' &&
      counts['day-4'] === '1' &&
      counts['day-5'] === '0' &&
      counts['lost'] === '1',
    JSON.stringify(counts)
  );

  const seededWidths = await barWidths(page);
  const dayThree = seededWidths['day-3'] ?? -1;
  const others = Object.entries(seededWidths)
    .filter(([id]) => id !== 'day-3')
    .map(([, width]) => width);
  check(
    'Day 3 is the longest distribution bar',
    dayThree > 0 && others.every((width) => width < dayThree),
    JSON.stringify(seededWidths)
  );

  const barLabels = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="distribution-bar-day-3"]');
    return {
      role: bar?.getAttribute('role') ?? 'missing',
      label: bar?.getAttribute('aria-label') ?? 'missing',
    };
  });
  check(
    'distribution bars expose their value to screen readers',
    barLabels.role === 'img' && barLabels.label === '2 solves',
    `role=${barLabels.role} aria-label=${JSON.stringify(barLabels.label)}`
  );

  await page.screenshot({ path: SHOT_SEEDED, fullPage: true });

  out();
  return seeded;
}

async function scenarioTransfer(page: Page, seeded: Figures): Promise<void> {
  out('Scenario 2: journal export/import round-trips');
  out('--------------------------------------------');

  await page.goto(STATS_URL, { waitUntil: 'domcontentloaded' });
  await seedStorage(page, buildJournal());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  await page.locator('[data-testid="transfer-export"]').click();
  const code = await page.locator('[data-testid="transfer-code"]').inputValue();
  check(
    'export produces a non-empty transfer code',
    code.trim().length > 0,
    `${code.length} characters`
  );
  check(
    'transfer code does not leak raw JSON',
    !code.includes('{'),
    code.slice(0, 32) + (code.length > 32 ? '...' : '')
  );

  await clearStorage(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  const wiped = await readFigures(page);
  check(
    'wiped storage returns the panel to zero state',
    wiped.played === '0' && wiped.won === '0' && wiped.averageDay === EM_DASH,
    `played=${wiped.played} won=${wiped.won} average=${JSON.stringify(wiped.averageDay)}`
  );

  await page.locator('[data-testid="transfer-code"]').fill(code);
  await page.locator('[data-testid="transfer-import"]').click();
  await waitForReady(page);

  const restored = await readFigures(page);
  const restoredText = await page.locator('[data-testid="stats-panel"]').innerText();
  check(
    'restored state has no NaN/Infinity/undefined',
    !FORBIDDEN.test(restoredText),
    FORBIDDEN.test(restoredText)
      ? `matched ${JSON.stringify(FORBIDDEN.exec(restoredText)?.[0])}`
      : 'panel innerText clean'
  );

  const identical = (Object.keys(seeded) as Array<keyof Figures>).filter(
    (key) => seeded[key] !== restored[key]
  );
  check(
    'every restored figure matches the pre-wipe original',
    identical.length === 0,
    identical.length === 0
      ? JSON.stringify(restored)
      : `differs on ${identical.join(', ')}: before=${JSON.stringify(
          seeded
        )} after=${JSON.stringify(restored)}`
  );
  check(
    'restored streaks survive the round trip',
    restored.currentStreak === '4' && restored.longestStreak === '4',
    `current=${restored.currentStreak} longest=${restored.longestStreak}`
  );

  const status = await readCell(page, 'transfer-status');
  check(
    'import reports success rather than failing silently',
    status.length > 0,
    JSON.stringify(status)
  );

  await page.screenshot({ path: EVIDENCE_TRANSFER_PNG, fullPage: true });
  out();
}

async function composeStatesEvidence(page: Page): Promise<void> {
  const zero = await Bun.file(SHOT_ZERO).arrayBuffer();
  const seeded = await Bun.file(SHOT_SEEDED).arrayBuffer();
  const toDataUrl = (buffer: ArrayBuffer) =>
    `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;

  await page.setViewportSize({ width: 860, height: 1200 });
  await page.setContent(
    `<body style="margin:0;background:#1c1814;font:14px monospace;color:#f0e6d2">
       <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
         <figure style="margin:0"><figcaption style="padding:6px 0">ZERO STATE</figcaption>
           <img src="${toDataUrl(zero)}" width="390"></figure>
         <figure style="margin:0"><figcaption style="padding:6px 0">SEEDED: 4 WINS (DAYS 2,3,3,4) + 1 LOSS</figcaption>
           <img src="${toDataUrl(seeded)}" width="390"></figure>
       </div>
     </body>`
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: EVIDENCE_STATES_PNG, fullPage: true });
}

async function main(): Promise<void> {
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ executablePath: EXECUTABLE });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    out(`Task 24 ${EM_DASH} statistics panel QA`);
    out(`target: ${STATS_URL}`);
    out();

    const seeded = await scenarioStates(page);
    await Bun.write(EVIDENCE_STATES_TXT, `${lines.join('\n')}\n`);

    await scenarioTransfer(page, seeded);
    await composeStatesEvidence(page);

    out(
      failures.length === 0
        ? `RESULT: PASS ${EM_DASH} all checks green`
        : `RESULT: FAIL ${EM_DASH} ${failures.join('; ')}`
    );

    await Bun.write(EVIDENCE_STATES_TXT, `${lines.join('\n')}\n`);
    await Bun.write(EVIDENCE_TRANSFER_TXT, `${lines.join('\n')}\n`);
  } finally {
    await browser?.close();
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

await main();
