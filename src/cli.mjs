import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssignment, loadRoster, resolveSubmission } from './assignment.mjs';
import { calibrate, gradeAll, gradeSubmission } from './grade.mjs';
import { closedLoop, renderLoopTranscript } from './loop.mjs';
import { renderFeedback, renderHtml, summarizeCalibration, writeReport } from './report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOLEAN_FLAGS = new Set(['headed', 'force', 'help', 'commit']);

const HELP = `Profe: the teaching assistant that actually runs your students' apps.

Every acceptance criterion is a plain-English Kane CLI test (tests/*_test.md)
that runs in a real Chrome against each student's app. Every point comes with
evidence, and the teacher approves every grade.

Usage
  profe calibrate <assignment-dir>         Check the rubric itself: the reference solution must
                                           pass every criterion and each known-bad mutant must fail.
  profe grade <roster.json>                Grade every submission in a roster.
      --only <name[,name]>                 Grade only these students.
      --out <dir>                          Report folder (default: reports/<assignment>-<time>).
  profe check <assignment-dir> --app <folder|url>
                                           Student self-check. Writes profe-feedback.md; exit 0
                                           only when every criterion passes.
  profe loop <assignment-dir> --app <folder> --agent "<agent command>"
                                           Closed loop: grade, hand the feedback to a coding agent
                                           (e.g. "codex exec --full-auto" or "claude -p --permission-mode
                                           acceptEdits"), grade again, until everything passes.
      --rounds <n>                         Agent rounds at most (default 3).
      --commit                             Commit every grade and every agent fix (git).
  profe report <report.json>               Re-render the HTML dashboard from a report.json.
  profe demo                               Calibrate, then grade the example submissions.

Common options
  --parallel <n>      Chrome workers per submission (default 3)
  --concurrency <n>   Submissions graded at the same time (default 2)
  --timeout <s>       Give up on a submission after this many seconds (default 1800)
  --headed            Show the browser windows
  --work <dir>        Where per-submission Kane workspaces live (default .profe/work)

Needs kane-cli (npm i -g @testmuai/kane-cli) signed in to a TestMu AI account (kane-cli login).`;

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (eq !== -1) flags[key] = arg.slice(eq + 1);
    else if (BOOLEAN_FLAGS.has(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return { positional, flags };
}

export async function main(argv) {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  if (!command || command === 'help' || command === '--help' || command === '-h' || flags.help) {
    console.log(HELP);
    return 0;
  }
  switch (command) {
    case 'grade':
      return cmdGrade(positional, flags);
    case 'check':
      return cmdCheck(positional, flags);
    case 'loop':
      return cmdLoop(positional, flags);
    case 'calibrate':
      return cmdCalibrate(positional, flags);
    case 'report':
      return cmdReport(positional);
    case 'demo':
      return cmdDemo(flags);
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      return 2;
  }
}

function options(flags) {
  return {
    workRoot: resolve(flags.work ?? '.profe/work'),
    parallel: positiveInt(flags.parallel, 3),
    concurrency: positiveInt(flags.concurrency, 2),
    timeoutSec: positiveInt(flags.timeout, 1800),
    headless: !flags.headed,
    onProgress: printProgress,
  };
}

async function cmdGrade(positional, flags) {
  if (!positional[0]) throw new Error('usage: profe grade <roster.json>');
  const roster = loadRoster(positional[0]);
  const assignmentDir = flags.assignment ? resolve(flags.assignment) : roster.assignmentDir;
  if (!assignmentDir) throw new Error('The roster has no "assignment" path; pass --assignment <dir>');
  const rubric = loadAssignment(assignmentDir);
  let submissions = roster.submissions;
  if (flags.only) {
    const wanted = String(flags.only).toLowerCase().split(',').map((s) => s.trim());
    submissions = submissions.filter((s) => wanted.includes(s.student.toLowerCase()) || wanted.includes(s.slug));
  }
  if (!submissions.length) throw new Error('No submissions to grade');

  console.log(`Profe · ${rubric.title} · ${submissions.length} submission(s) × ${rubric.criteria.length} criteria\n`);
  const results = await gradeAll({ rubric, submissions, ...options(flags) });
  const outDir = resolve(flags.out ?? join('reports', `${rubric.id}-${stamp()}`));
  const paths = writeReport({ rubric, results, calibration: readCalibration(rubric), outDir });
  printSummary(results, rubric);
  console.log(`\nReport:   ${relative(process.cwd(), paths.html)}`);
  console.log(`Grades:   ${relative(process.cwd(), paths.csv)}`);
  return results.some((r) => r.kane.infraError) ? 2 : 0;
}

async function cmdCheck(positional, flags) {
  if (!positional[0] || !flags.app || flags.app === true) {
    throw new Error('usage: profe check <assignment-dir> --app <folder|url>');
  }
  const rubric = loadAssignment(positional[0]);
  const submission = resolveSubmission({ student: flags.name ?? 'self-check', app: String(flags.app) });
  console.log(`Profe self-check · ${rubric.title} · ${rubric.criteria.length} criteria\n`);
  const result = await gradeSubmission({ rubric, submission, ...options(flags) });
  const command = `profe check ${relative(process.cwd(), rubric.dir) || '.'} --app ${flags.app}`;
  const feedbackFile = resolve(flags.out ?? 'profe-feedback.md');
  writeFileSync(feedbackFile, renderFeedback(rubric, result, { checkCommand: command }));
  printSummary([result], rubric);
  console.log(`\nFeedback: ${relative(process.cwd(), feedbackFile)}`);
  if (result.kane.infraError) return 2;
  return result.failedCount === 0 && result.unverifiedCount === 0 ? 0 : 1;
}

async function cmdLoop(positional, flags) {
  if (!positional[0] || !flags.app || flags.app === true || !flags.agent || flags.agent === true) {
    throw new Error('usage: profe loop <assignment-dir> --app <folder> --agent "<agent command>" [--rounds 3] [--commit]');
  }
  const rubric = loadAssignment(positional[0]);
  const submission = resolveSubmission({ student: flags.name ?? 'self-check', app: String(flags.app) });
  console.log(`Profe loop · ${rubric.title} · agent: ${flags.agent}`);
  const loop = await closedLoop({
    ...options(flags),
    rubric,
    submission,
    agentCommand: String(flags.agent),
    maxRounds: positiveInt(flags.rounds, 3),
    commit: Boolean(flags.commit),
    onRound: printRound,
  });
  const transcript = resolve(flags.transcript ?? join(submission.dir, 'profe-loop.md'));
  writeFileSync(transcript, renderLoopTranscript(rubric, loop));
  const first = loop.rounds[0];
  const last = loop.rounds.at(-1);
  console.log(
    `\n${loop.ok ? '✓' : '✗'} ${first.passed}/${first.total} → ${last.passed}/${last.total} criteria after ${loop.rounds.length - 1} agent round(s)`,
  );
  console.log(`Transcript: ${relative(process.cwd(), transcript)}`);
  if (loop.infraError) return 2;
  return loop.ok ? 0 : 1;
}

function printRound(event) {
  if (event.kind === 'graded') {
    const failing = event.failed.length ? ` · failing: ${event.failed.join(', ')}` : ' · all pass';
    console.log(`\n■ Round ${event.round}: ${event.passed}/${event.total} criteria${failing}${event.commit ? ` · commit ${event.commit}` : ''}\n`);
  } else if (event.kind === 'agent-start') {
    console.log(`→ Asking ${event.agent} to fix ${event.failed.join(', ')} (agent round ${event.round})…`);
  } else if (event.kind === 'agent-end') {
    console.log(`← ${event.agent} finished in ${event.durationS} s (exit ${event.exitCode})${event.commit ? ` · commit ${event.commit}` : ''}`);
  }
}

async function cmdCalibrate(positional, flags) {
  if (!positional[0]) throw new Error('usage: profe calibrate <assignment-dir>');
  const rubric = loadAssignment(positional[0]);
  const mutants = rubric.calibration?.mutants?.length ?? 0;
  console.log(`Profe calibrate · ${rubric.title} · reference + ${mutants} mutant(s) × ${rubric.criteria.length} criteria\n`);
  const result = await calibrate({ rubric, ...options(flags) });
  const summary = summarizeCalibration(result);
  writeFileSync(join(rubric.dir, 'calibration.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const s = summary.summary;
  console.log(`\nReference solution: ${s.referencePassed}/${s.referenceTotal} criteria passed`);
  console.log(`Known bugs caught:  ${s.knownBugsCaught}/${s.knownBugsTotal}`);
  if (result.ok) {
    console.log('\n✓ Calibrated: these tests can be trusted to grade students.');
  } else {
    console.log('\n✗ Not calibrated. Fix these before grading anyone:');
    for (const p of result.problems) {
      console.log(`  - ${p.message}${p.step ? ` (step "${p.step}")` : ''}${p.detail ? `\n      Kane: ${oneLine(p.detail)}` : ''}`);
    }
  }
  console.log(`\nSaved ${relative(process.cwd(), join(rubric.dir, 'calibration.json'))}`);
  return result.ok ? 0 : 1;
}

function cmdReport(positional) {
  if (!positional[0]) throw new Error('usage: profe report <report.json>');
  const file = resolve(positional[0]);
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const out = join(dirname(file), 'index.html');
  writeFileSync(out, renderHtml(report));
  console.log(`Wrote ${relative(process.cwd(), out)}`);
  return 0;
}

async function cmdDemo(flags) {
  const assignmentDir = join(ROOT, 'assignments', 'course-enrollment');
  console.log('Step 1/2 · Calibrate the rubric (reference solution + known-bad mutants)\n');
  const calibrated = await cmdCalibrate([assignmentDir], flags);
  if (calibrated !== 0 && !flags.force) {
    console.log('\nStopping: grading with uncalibrated tests would be unfair. Fix the tests, or pass --force.');
    return calibrated;
  }
  console.log('\nStep 2/2 · Grade the example submissions\n');
  return cmdGrade([join(ROOT, 'examples', 'roster.json')], { ...flags, out: flags.out ?? join('reports', 'demo') });
}

function readCalibration(rubric) {
  const file = join(rubric.dir, 'calibration.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function printProgress(event) {
  if (event.kind === 'start') {
    console.log(`▶ ${event.student}: ${event.url}`);
    return;
  }
  if (event.kind !== 'criterion') return;
  const mark = event.status === 'passed' ? '✓' : event.status === 'failed' ? '✗' : '?';
  const tail =
    event.status === 'failed' && event.reason
      ? ` · ${truncate(oneLine(event.reason), 110)}`
      : event.status !== 'passed' && event.status !== 'failed'
        ? ` (${event.status}: does not count, sent to the teacher)`
        : '';
  console.log(`  ${mark} ${event.student} · ${event.criterion} ${event.title}${tail}`);
}

function printSummary(results, rubric) {
  console.log('\nStudent            Grade   Passed  Failed  Unverified');
  for (const r of results) {
    const failed = r.criteria.filter((c) => c.status === 'failed').map((c) => c.id).join(' ');
    console.log(
      `${r.student.padEnd(18).slice(0, 18)} ${String(r.grade).padStart(5)}/${rubric.scale}  ${String(r.passedCount).padStart(4)}  ${String(r.failedCount).padStart(6)}  ${String(r.unverifiedCount).padStart(10)}${failed ? `   ${failed}` : ''}`,
    );
    if (r.kane.infraError) console.log(`  ⚠ ${r.kane.infraError}`);
  }
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function oneLine(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
