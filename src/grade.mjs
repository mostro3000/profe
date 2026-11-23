// Grading: run every criterion's Kane test against one submission, turn the
// results into a proposed grade, and calibrate the rubric itself.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { slugify } from './assignment.mjs';
import { findEvidencePack, memberPacks, readMemberLog, runTestrun, summarize } from './kane.mjs';
import { serveStatic } from './serve.mjs';

// Each submission gets its own copy of the tests, so Kane's recordings and
// evidence for one student never mix with another's. The test title gets the
// student's name, which is how the run shows up in Test Manager. (Titles are
// decorative to Kane: editing one never invalidates a recording.)
export function prepareWorkspace({ rubric, slug, label, workRoot }) {
  const work = join(workRoot, rubric.id, slug);
  const testsDir = join(work, 'tests');
  mkdirSync(testsDir, { recursive: true });
  const wanted = new Set();
  for (const criterion of rubric.criteria) {
    const name = basename(criterion.testPath);
    wanted.add(name);
    const source = readFileSync(criterion.testPath, 'utf8').replace(/^# (.+)$/m, (_, title) => `# ${title} · ${label}`);
    const dest = join(testsDir, name);
    if (!existsSync(dest) || readFileSync(dest, 'utf8') !== source) writeFileSync(dest, source);
  }
  for (const name of readdirSync(testsDir)) {
    if (name.endsWith('_test.md') && !wanted.has(name)) rmSync(join(testsDir, name));
  }
  return { work, testFiles: [...wanted].map((name) => `tests/${name}`) };
}

// Kane reports some harness problems as a failed step: the browser closed
// under load, the page never loaded, the DevTools connection dropped. Those say
// nothing about the student's work, so they count as "unverified" (retried, and
// never graded) exactly like a broken run.
const INFRA_FAILURE =
  /TargetClosedError|Target page, context or browser has been closed|browser has (been )?disconnected|Screenshot failed|CDP endpoint|ECONNREFUSED|net::ERR_|Protocol error|Session closed/i;

export function classify(kaneStatus, message) {
  if (kaneStatus === 'passed') return 'passed';
  if (kaneStatus === 'failed' && !(message && INFRA_FAILURE.test(message))) return 'failed';
  return 'unverified';
}

export async function gradeSubmission({
  rubric,
  submission,
  workRoot,
  parallel = 3,
  headless = true,
  timeoutSec = 1800,
  retries = 1,
  onProgress = () => {},
}) {
  const label = submission.student;
  const slug = submission.slug ?? slugify(label);
  const { work, testFiles } = prepareWorkspace({ rubric, slug, label, workRoot });
  const byFile = new Map(rubric.criteria.map((c) => [basename(c.testPath), c]));
  const startedAt = Date.now();

  let server = null;
  let url = submission.url ?? null;
  if (!url) {
    server = await serveStatic(submission.dir);
    url = server.url;
  }
  onProgress({ kind: 'start', student: label, url });

  // file name -> { end, log, pack, attempt }; a retry only replaces an entry
  // when it produced a verdict of its own.
  const outcomes = new Map();
  const attempts = [];
  try {
    let pending = testFiles;
    for (let attempt = 0; attempt <= retries && pending.length; attempt++) {
      if (attempt > 0) onProgress({ kind: 'retry', student: label, attempt, files: pending.map((f) => byFile.get(basename(f))?.id ?? f) });
      const attemptStart = Date.now();
      const run = await runTestrun({
        cwd: work,
        testFiles: pending,
        startUrl: url,
        parallel,
        headless,
        timeoutSec,
        onEvent: (event) => {
          if (event.type !== 'testrun_member_end' && event.type !== 'testrun_authored_member_end') return;
          const criterion = byFile.get(basename(event.path));
          onProgress({
            kind: 'criterion',
            student: label,
            criterion: criterion?.id ?? basename(event.path),
            title: criterion?.title ?? '',
            status: classify(event.status, event.failure?.message),
            kaneStatus: event.status,
            reason: event.failure?.message ?? null,
            durationS: event.duration_s ?? null,
            attempt,
          });
        },
      });
      const kane = summarize(run.events);
      attempts.push({ run, kane, startedAt: attemptStart });
      const packs = memberPacks(kane.summary, work);
      for (const file of pending) {
        const name = basename(file);
        const end = kane.members.get(name);
        if (!end) continue;
        outcomes.set(name, { end, log: readMemberLog(end.log_path), pack: packs.get(name) ?? null, attempt });
      }
      // Kane never got going (not signed in, no Chrome): retrying won't help.
      if (kane.members.size === 0) break;
      pending = pending.filter((file) => {
        const outcome = outcomes.get(basename(file));
        return !outcome || classify(outcome.end.status, outcome.end.failure?.message ?? outcome.log.reason) === 'unverified';
      });
    }
  } finally {
    await server?.close();
  }

  const { run, kane } = attempts[0];
  const criteria = rubric.criteria.map((criterion) => {
    const file = basename(criterion.testPath);
    const outcome = outcomes.get(file);
    const end = outcome?.end;
    const log = outcome?.log ?? {};
    const kaneStatus = end?.status ?? 'missing';
    // Only a real pass or a real fail counts. Anything else (broken, interrupted,
    // a harness error, never ran) is "unverified": it goes to the teacher and
    // never costs points.
    const status = classify(kaneStatus, end?.failure?.message ?? log.reason);
    const stepIndex = Number.isInteger(end?.failure?.step_index) ? end.failure.step_index : (log.failedStep ?? null);
    return {
      id: criterion.id,
      title: criterion.title,
      text: criterion.text,
      points: criterion.points,
      test: criterion.test,
      status,
      kaneStatus,
      reason: status === 'passed' ? null : (end?.failure?.message ?? log.reason ?? null),
      failedStep: status === 'passed' ? null : stepIndex,
      failedStepTitle: status === 'passed' ? null : stepTitle(criterion.steps, stepIndex),
      summary: log.summary ?? null,
      observed: log.observed ?? null,
      testUrl: log.testUrl ?? null,
      durationS: end?.duration_s ?? null,
      sessionId: end?.session_id ?? null,
      logPath: end?.log_path ?? null,
      evidencePack: outcome?.pack ?? null,
      attempts: outcome ? outcome.attempt + 1 : 0,
    };
  });

  const infraError = run.spawnError
    ? `Could not start kane-cli: ${run.spawnError}`
    : kane.members.size === 0
      ? describeRunFailure(run, kane)
      : null;

  return {
    student: label,
    slug,
    email: submission.email ?? null,
    app: submission.app ?? url,
    url: submission.url ?? null,
    gradedAt: new Date(startedAt).toISOString(),
    durationS: Math.round((Date.now() - startedAt) / 1000),
    criteria,
    ...score(criteria, rubric.scale),
    evidence: findEvidencePack(work, startedAt, kane.evidenceId ?? kane.summary?.execution?.evidence_id ?? kane.executionId),
    workDir: work,
    kane: {
      exitCode: run.exitCode,
      executionId: kane.executionId,
      evidenceId: kane.evidenceId,
      totals: kane.summary?.totals ?? null,
      overall: kane.done?.overall_status ?? null,
      retried: attempts.length - 1,
      errors: attempts.flatMap((a) => a.kane.errors.map((e) => e.detail ?? e.message ?? e.code)).filter(Boolean),
      infraError,
    },
  };
}

// Kane numbers test.md steps from 1. Map the index to the step's "## " heading.
function stepTitle(steps, index) {
  if (index === null || index === undefined || !steps?.length) return null;
  return steps[Math.max(0, index - 1)] ?? null;
}

export function score(criteria, scale = 10) {
  const maxPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  const earned = criteria.filter((c) => c.status === 'passed').reduce((sum, c) => sum + c.points, 0);
  const count = (status) => criteria.filter((c) => c.status === status).length;
  return {
    earned,
    maxPoints,
    grade: maxPoints ? Math.round((scale * earned * 10) / maxPoints) / 10 : 0,
    scale,
    passedCount: count('passed'),
    failedCount: count('failed'),
    unverifiedCount: count('unverified'),
    needsReview: count('unverified') > 0,
  };
}

function describeRunFailure(run, kane) {
  const parts = [
    ...kane.errors.map((e) => e.detail ?? e.message ?? e.code),
    ...run.stderr
      .split('\n')
      .filter((line) => /error/i.test(line))
      .slice(-3),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : `kane-cli exited with code ${run.exitCode} before running any test`;
}

export async function gradeAll({ submissions, concurrency = 2, ...options }) {
  return mapLimit(submissions, concurrency, (submission) => gradeSubmission({ ...options, submission }));
}

// "Who grades the grader?" A rubric is calibrated when:
// - the reference solution passes every criterion (no student is failed by a
//   broken test);
// - each known-bad mutant fails the criteria it breaks (the tests bite);
// - and each mutant passes every other criterion, unless the rubric lists it
//   under mayAlsoFail (a test that fails a nearly-correct app is flaky or
//   over-strict, and would cost some student a point).
export async function calibrate({ rubric, concurrency = 2, ...options }) {
  const calibration = rubric.calibration ?? {};
  if (!calibration.reference) throw new Error(`${rubric.id}: rubric.json has no calibration.reference`);
  const jobs = [
    {
      role: 'reference',
      mustFail: [],
      submission: { student: 'reference', slug: 'reference', app: calibration.reference, dir: join(rubric.dir, calibration.reference) },
    },
    ...(calibration.mutants ?? []).map((mutant) => ({
      role: 'mutant',
      mustFail: mutant.mustFail ?? [],
      mayAlsoFail: mutant.mayAlsoFail ?? [],
      submission: {
        student: `mutant ${basename(mutant.path)}`,
        slug: `mutant-${basename(mutant.path)}`,
        app: mutant.path,
        dir: join(rubric.dir, mutant.path),
      },
    })),
  ];
  const runs = await mapLimit(jobs, concurrency, async (job) => ({
    role: job.role,
    mustFail: job.mustFail,
    mayAlsoFail: job.mayAlsoFail ?? [],
    result: await gradeSubmission({ ...options, rubric, submission: job.submission }),
  }));

  const problems = [];
  const reference = runs.find((run) => run.role === 'reference').result;
  for (const c of reference.criteria) {
    if (c.status === 'failed') {
      problems.push({
        criterion: c.id,
        kind: 'fails-on-reference',
        message: `${c.id} fails on the reference solution: the test or the criterion is wrong or ambiguous.`,
        detail: c.reason,
        step: c.failedStepTitle,
      });
    } else if (c.status === 'unverified') {
      problems.push({
        criterion: c.id,
        kind: 'unverified-on-reference',
        message: `${c.id} could not run on the reference solution.`,
        detail: c.reason ?? reference.kane.infraError,
      });
    }
  }
  for (const run of runs.filter((r) => r.role === 'mutant')) {
    for (const id of run.mustFail) {
      const c = run.result.criteria.find((x) => x.id === id);
      if (!c) {
        problems.push({ criterion: id, kind: 'unknown-criterion', message: `${run.result.app}: unknown criterion ${id}` });
      } else if (c.status !== 'failed') {
        problems.push({
          criterion: id,
          kind: 'misses-known-bug',
          mutant: run.result.app,
          message: `${id} did not catch the known bug in ${run.result.app} (result: ${c.status}).`,
          detail: c.summary ?? c.reason,
        });
      }
    }
    for (const c of run.result.criteria) {
      if (run.mustFail.includes(c.id) || run.mayAlsoFail.includes(c.id) || c.status === 'passed') continue;
      problems.push({
        criterion: c.id,
        kind: c.status === 'failed' ? 'unexpected-fail-on-mutant' : 'unverified-on-mutant',
        mutant: run.result.app,
        message:
          c.status === 'failed'
            ? `${c.id} failed on ${run.result.app}, which only breaks ${run.mustFail.join(', ')}: the test is flaky or too strict.`
            : `${c.id} could not run on ${run.result.app}.`,
        detail: c.reason,
        step: c.failedStepTitle,
      });
    }
  }
  return { assignment: rubric.id, calibratedAt: new Date().toISOString(), ok: problems.length === 0, problems, runs };
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
