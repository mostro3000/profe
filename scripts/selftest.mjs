#!/usr/bin/env node
// Kane checks Profe itself: serve a generated report and run the dashboard
// test in selftest/ against it, the same way Profe grades a student.
//
//   node scripts/selftest.mjs [report-dir]      (default: reports/demo)
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../src/grade.mjs';
import { readMemberLog, runTestrun, summarize } from '../src/kane.mjs';
import { serveStatic } from '../src/serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(process.argv[2] ?? join(root, 'reports', 'demo'));
if (!existsSync(join(reportDir, 'index.html'))) {
  console.error(`No report in ${reportDir}. Run "node bin/profe.mjs demo" first.`);
  process.exit(2);
}

const work = join(root, '.profe', 'work', 'selftest');
mkdirSync(join(work, 'tests'), { recursive: true });
for (const name of readdirSync(join(root, 'selftest'))) {
  if (name.endsWith('_test.md')) cpSync(join(root, 'selftest', name), join(work, 'tests', name));
}
const testFiles = readdirSync(join(work, 'tests'))
  .filter((name) => name.endsWith('_test.md'))
  .map((name) => `tests/${name}`);

const server = await serveStatic(reportDir);
console.log(`Kane is checking the Profe dashboard at ${server.url}\n`);
let run;
try {
  run = await runTestrun({ cwd: work, testFiles, startUrl: server.url, parallel: 1 });
} finally {
  await server.close();
}

let failed = 0;
for (const [name, end] of summarize(run.events).members) {
  const log = readMemberLog(end.log_path);
  const status = classify(end.status, end.failure?.message);
  if (status !== 'passed') failed++;
  console.log(`${status === 'passed' ? '✓' : status === 'failed' ? '✗' : '?'} ${name}${end.failure?.message ? ` · ${end.failure.message}` : ''}`);
  if (log.testUrl) console.log(`  watch: ${log.testUrl}`);
}
if (run.exitCode === 2 || summarize(run.events).members.size === 0) {
  console.error(`kane-cli could not run (exit ${run.exitCode}).\n${run.stderr.slice(-800)}`);
  process.exit(2);
}
process.exit(failed ? 1 : 0);
