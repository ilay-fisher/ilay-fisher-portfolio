// Reads Playwright JSON reports and prints a markdown summary (to $GITHUB_STEP_SUMMARY when set, and to stdout).
// A test that needed a retry is listed under "Flaky": a retry must never be silent. Exit code is always 0; the
// Playwright run itself decides pass or fail.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const files = process.argv.slice(2).filter((f) => existsSync(f));
const flaky = [];
const failed = [];
let passed = 0;
let durationMs = 0;

function walk(suite, trail) {
  const t = suite.title ? [...trail, suite.title] : trail;
  for (const s of suite.suites ?? []) walk(s, t);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = [...t, spec.title].join(' > ');
      if (test.status === 'flaky') flaky.push(`${name} (${test.results.length} attempts)`);
      else if (test.status === 'unexpected') failed.push(name);
      else if (test.status === 'expected') passed++;
    }
  }
}
for (const f of files) {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  durationMs += r.stats?.duration ?? 0;
  for (const s of r.suites ?? []) walk(s, []);
}

const lines = [
  '## e2e summary',
  `${passed} passed, ${failed.length} failed, ${flaky.length} flaky (needed a retry), ${(durationMs / 60000).toFixed(1)} min of test time.`,
];
if (flaky.length) lines.push('', '### Flaky (passed only on retry)', ...flaky.map((n) => `- ${n}`));
if (failed.length) lines.push('', '### Failed', ...failed.map((n) => `- ${n}`));
const out = lines.join('\n') + '\n';
process.stdout.write(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
