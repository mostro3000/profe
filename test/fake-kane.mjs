#!/usr/bin/env node
// Stand-in for kane-cli in unit tests. Mimics `kane-cli testrun run --agent`:
// the suite's NDJSON events on stdout, one event log per test (run_end with
// final_state, test_md_step_end with 1-based step_index, test_md_done with a
// share_url), and sealed evidence packs under .testmuai/evidence/.
// Outcomes come from FAKE_KANE_SCENARIO:
//   { "<workspace slug>": { "<test file name>": { status, message, step_index, observed } } }
// A slug mapped to "crash" exits with code 2 before running anything.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
if (args[0] !== 'testrun' || args[1] !== 'run') {
  console.error('fake-kane: only "testrun run" is supported');
  process.exit(2);
}
const files = [];
let url = null;
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--override-start-url') url = args[++i];
  else if (args[i] === '--parallel') i++;
  else if (!args[i].startsWith('--')) files.push(args[i]);
}

const emit = (event) => process.stdout.write(`${JSON.stringify({ ...event, v: 1, ts: new Date().toISOString() })}\n`);
const slug = basename(process.cwd());
const scenario = process.env.FAKE_KANE_SCENARIO ? JSON.parse(readFileSync(process.env.FAKE_KANE_SCENARIO, 'utf8')) : {};
const outcomes = scenario[slug] ?? {};

emit({ type: 'stream_start', cli_version: 'fake', surface: 'testrun' });
if (outcomes === 'crash') {
  emit({ type: 'error', code: 'AUTH_REQUIRED', detail: 'not signed in' });
  process.exit(2);
}

// Prove that the submission is really being served at the override URL.
const page = await fetch(url).then((res) => res.text()).catch(() => '');
if (!page.includes('<html')) {
  emit({ type: 'error', code: 'UNREACHABLE', detail: `could not load ${url}` });
  process.exit(2);
}

const executionId = `exec-${slug}`;
const evidence = join('.testmuai', 'evidence');
mkdirSync(evidence, { recursive: true });
emit({ type: 'testrun_plan', valid: true, parallel: 1, members: files.map((path) => ({ path, tags: [] })) });
let failed = 0;
const authored = [];
for (const path of files) {
  const name = basename(path);
  const outcome = outcomes[name] ?? { status: 'passed' };
  const sessionId = `s-${slug}-${name}`;
  const logPath = join(process.cwd(), `${name}.events.ndjson`);
  const shareUrl = `https://example.test/share/${slug}/${name}`;
  const passed = outcome.status === 'passed';
  const log = [
    { type: 'run_end', status: outcome.status, summary: outcome.summary ?? `Fake run of ${name}.`, reason: passed ? 'Objective completed' : (outcome.message ?? 'failed'), final_state: { url, ...(outcome.observed ?? {}) } },
    ...(passed ? [] : [{ type: 'test_md_step_end', step_index: outcome.step_index ?? 1, status: 'failed' }]),
    { type: 'test_md_done', overall_status: outcome.status, session_id: sessionId, share_url: shareUrl },
  ];
  writeFileSync(logPath, `${log.map((e) => JSON.stringify(e)).join('\n')}\n`);
  writeFileSync(join(evidence, `${sessionId}.evidence`), `fake pack for ${name}`);
  authored.push({ path, status: outcome.status, source_execution_id: sessionId, execution_id: executionId });
  emit({ type: 'testrun_authored_member_start', path, session_id: sessionId, log_path: logPath });
  if (!passed) failed++;
  emit({
    type: 'testrun_authored_member_end',
    path,
    status: outcome.status,
    duration_s: 1.5,
    session_id: sessionId,
    log_path: logPath,
    ...(passed ? {} : { failure: { message: outcome.message ?? 'failed', step_index: outcome.step_index ?? 1 } }),
  });
}
writeFileSync(join(evidence, `${executionId}.evidence`), 'fake consolidated pack');
emit({ type: 'testrun_evidence_ingest', status: 'ok', evidence_id: executionId });
emit({
  type: 'testrun_summary',
  execution: { id: executionId, status: failed ? 'failed' : 'passed', evidence_id: executionId },
  authored,
  totals: { tests: files.length, passed: files.length - failed, failed, broken: 0, skipped: 0, authored: files.length },
  duration_s: 3,
});
emit({ type: 'testrun_done', execution_id: executionId, overall_status: failed ? 'failed' : 'passed' });
process.exit(failed ? 1 : 0);
