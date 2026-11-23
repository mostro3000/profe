// Thin wrapper around `kane-cli testrun run`: spawns it in agent mode, streams
// its NDJSON events, and condenses them into one result per test file.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';

export function kaneCommand() {
  // PROFE_KANE_BIN points at another binary, e.g. "node test/fake-kane.mjs".
  const raw = process.env.PROFE_KANE_BIN?.trim() || 'kane-cli';
  return raw.split(/\s+/);
}

export function runTestrun({
  cwd,
  testFiles,
  startUrl,
  parallel = 3,
  headless = true,
  timeoutSec = 1800,
  extraArgs = [],
  onEvent = () => {},
}) {
  const [cmd, ...prefix] = kaneCommand();
  // testrun takes *_test.md paths (not a folder) and emits NDJSON with --agent.
  const args = [
    ...prefix,
    'testrun',
    'run',
    ...testFiles,
    '--override-start-url',
    startUrl,
    '--parallel',
    String(parallel),
    '--agent',
    ...(headless ? ['--headless'] : []),
    ...extraArgs,
  ];

  return new Promise((resolveRun) => {
    const events = [];
    let stderr = '';
    let exitCode = null;
    let streamClosed = false;
    let settled = false;

    // stdin is ignored (like `< /dev/null`) so testrun never waits on a TTY.
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    const timer = setTimeout(() => {
      child.kill('SIGINT');
      setTimeout(() => child.kill('SIGKILL'), 20000).unref();
    }, timeoutSec * 1000);
    const finish = (extra = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ exitCode: exitCode ?? 3, events, stderr: stderr.slice(-8000), args, ...extra });
    };
    const maybeFinish = () => {
      if (exitCode !== null && streamClosed) finish();
    };

    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const text = line.trim();
      if (!text.startsWith('{')) return;
      try {
        const event = JSON.parse(text);
        events.push(event);
        onEvent(event);
      } catch {
        // Kane writes its UI to stderr; a non-JSON stdout line is just skipped.
      }
    });
    lines.on('close', () => {
      streamClosed = true;
      maybeFinish();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 64000) stderr = stderr.slice(-32000);
    });
    child.on('error', (err) => {
      exitCode = 127;
      finish({ spawnError: err.message });
    });
    child.on('close', (code) => {
      exitCode = code ?? 3;
      maybeFinish();
    });
  });
}

// Condense the event stream. Tests with no recording yet are authored in a
// second pass and end with `testrun_authored_member_end`; the latest end event
// for a file wins.
export function summarize(events) {
  const out = {
    members: new Map(),
    errors: [],
    plan: null,
    summary: null,
    done: null,
    executionId: null,
    evidenceId: null,
    verdict: null,
  };
  for (const event of events) {
    switch (event.type) {
      case 'testrun_plan':
        out.plan = event;
        break;
      case 'testrun_start':
        out.executionId = event.execution_id ?? out.executionId;
        break;
      case 'testrun_member_end':
      case 'testrun_authored_member_end':
        out.members.set(basename(event.path), event);
        break;
      case 'testrun_evidence_ingest':
        out.evidenceId = event.evidence_id ?? out.evidenceId;
        break;
      case 'testrun_summary':
        out.summary = event;
        break;
      case 'verdict':
        out.verdict = event;
        break;
      case 'testrun_done':
        out.done = event;
        out.executionId = out.executionId ?? event.execution_id;
        break;
      case 'error':
        out.errors.push(event);
        break;
      default:
        break;
    }
  }
  return out;
}

// Each test writes its own event log (log_path): one run_end per step with
// Kane's account of what it did and the values it read (final_state), step
// results (test_md_step_end, 1-based), and a public Test Manager share_url.
export function readMemberLog(logPath) {
  const details = {};
  if (!logPath || !existsSync(logPath)) return details;
  let text;
  try {
    text = readFileSync(logPath, 'utf8');
  } catch {
    return details;
  }
  const runs = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('{')) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'run_end') runs.push(event);
    if (event.type === 'test_md_step_end' && event.status === 'failed' && details.failedStep === undefined) {
      details.failedStep = event.step_index;
    }
    if ((event.type === 'test_md_done' || event.type === 'test_md_summary') && event.share_url) {
      details.testUrl = event.share_url;
    }
    if (!details.testUrl && typeof event.test_url === 'string') details.testUrl = event.test_url;
  }
  // The run that decided the outcome: the first failing one, else the last one.
  const decisive = runs.find((run) => run.status && run.status !== 'passed') ?? runs.at(-1);
  if (decisive) {
    details.summary = decisive.summary ?? decisive.one_liner;
    details.reason = decisive.reason;
    if (decisive.final_state && typeof decisive.final_state === 'object') {
      const { url, ...observed } = decisive.final_state;
      if (Object.keys(observed).length) details.observed = observed;
    }
  }
  return details;
}

// Where a suite's sealed evidence packs land: one consolidated pack named after
// the execution, plus one per test (its source_execution_id).
export function evidenceDir(cwd) {
  return join(cwd, '.testmuai', 'evidence');
}

export function memberPacks(summaryEvent, cwd) {
  const packs = new Map();
  for (const value of Object.values(summaryEvent ?? {})) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      const id = entry?.source_execution_id;
      if (!entry?.path || !id) continue;
      const file = join(evidenceDir(cwd), `${id}.evidence`);
      if (existsSync(file)) packs.set(basename(entry.path), file);
    }
  }
  return packs;
}

// Prefer the consolidated pack named after the evidence id; otherwise take the
// newest pack written since the run started.
export function findEvidencePack(cwd, sinceMs, preferredId = null) {
  const dir = evidenceDir(cwd);
  if (!existsSync(dir)) return null;
  if (preferredId && existsSync(join(dir, `${preferredId}.evidence`))) return join(dir, `${preferredId}.evidence`);
  const packs = readdirSync(dir)
    .filter((name) => name.endsWith('.evidence'))
    .map((name) => ({ path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    .filter((pack) => pack.mtime >= sinceMs - 1000)
    .sort((a, b) => b.mtime - a.mtime);
  return packs[0]?.path ?? null;
}
