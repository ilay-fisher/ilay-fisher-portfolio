// Runs the e2e suite as CI does: the `default` project in parallel, then the `gl-heavy` project alone (one worker).
// Playwright's worker count is global, so two invocations are the way to get one project serial. Extra arguments
// (for example --retries=0, --repeat-each=2, a file filter) go to both runs. Exit code is non-zero if either failed.
import { spawnSync } from 'node:child_process';

const extra = process.argv.slice(2);
const run = (args) =>
  spawnSync('npx', ['playwright', 'test', ...args, ...extra], {
    stdio: 'inherit',
    env: process.env,
  }).status ?? 1;

const first = run(['--project=default']);
const second = run(['--project=gl-heavy', '--workers=1']);
process.exit(first || second);
