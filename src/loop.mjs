// The closed loop: grade with Kane → hand the feedback to a coding agent →
// grade again, until every criterion passes or the rounds run out.
//
// The agent only edits files in the app folder. Kane (and the network and the
// TestMu credentials it needs) stay outside the agent's sandbox: Profe runs the
// checks between rounds, so any agent CLI works without extra permissions.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gradeSubmission } from './grade.mjs';
import { renderFeedback } from './report.mjs';

export function agentPrompt() {
  return [
    "You are a coding agent fixing a student's web app for a university assignment.",
    'The app is in the current folder. ASSIGNMENT.md is the assignment; profe-feedback.md is the latest grading,',
    'done in a real Chrome browser by Kane CLI, with what failed, where, and what Kane read on the page.',
    'Fix the app so that every criterion marked ❌ passes.',
    'Rules: keep the starting data and the labels required by the UI contract; only edit files in this folder;',
    'do not run the grader yourself, Profe re-runs Kane after you finish.',
    'When you are done, reply with one line per criterion you fixed: what was wrong and what you changed.',
  ].join(' ');
}

// The agent is a fresh process of its own: when Profe itself runs inside a
// coding-agent session, that session's identity must not leak into the
// student's agent.
export function agentEnv(env = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_JOB_DIR|CLAUDE_PID|CLAUDE_EFFORT)/.test(key)),
  );
}

export function runAgent({ command, cwd, prompt, timeoutSec = 900 }) {
  const [cmd, ...args] = command.trim().split(/\s+/);
  return new Promise((resolveRun) => {
    const started = Date.now();
    let output = '';
    const child = spawn(cmd, [...args, prompt], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: agentEnv() });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSec * 1000);
    const collect = (chunk) => {
      output += chunk;
      if (output.length > 200000) output = output.slice(-100000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveRun({ exitCode: 127, output: String(err.message), durationS: 0 });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ exitCode: code ?? 1, output, durationS: Math.round((Date.now() - started) / 1000) });
    });
  });
}

function gitCommit(dir, message) {
  const add = spawnSync('git', ['add', '-A', '.'], { cwd: dir, encoding: 'utf8' });
  if (add.status !== 0) return { ok: false, detail: add.stderr.trim() };
  // The feedback the agent read is part of the story, even where it is ignored.
  for (const file of ['profe-feedback.md', 'profe-loop.md']) {
    if (existsSync(join(dir, file))) spawnSync('git', ['add', '-f', file], { cwd: dir, encoding: 'utf8' });
  }
  const commit = spawnSync('git', ['commit', '-q', '-m', message, '--', '.'], { cwd: dir, encoding: 'utf8' });
  if (commit.status !== 0) return { ok: false, detail: (commit.stdout + commit.stderr).trim() };
  const rev = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  return { ok: true, sha: rev.stdout.trim() };
}

export async function closedLoop({
  rubric,
  submission,
  agentCommand,
  agentName = agentCommand.split(/\s+/)[0],
  maxRounds = 3,
  commit = false,
  onRound = () => {},
  ...gradeOptions
}) {
  if (!submission.dir) throw new Error('profe loop needs a local app folder (the agent edits files there)');
  const appDir = submission.dir;
  const assignmentCopy = join(appDir, 'ASSIGNMENT.md');
  if (!existsSync(assignmentCopy) && existsSync(join(rubric.dir, 'assignment.md'))) {
    copyFileSync(join(rubric.dir, 'assignment.md'), assignmentCopy);
  }

  const rounds = [];
  for (let round = 0; ; round++) {
    const result = await gradeSubmission({ ...gradeOptions, rubric, submission });
    writeFileSync(join(appDir, 'profe-feedback.md'), renderFeedback(rubric, result, { checkCommand: 'profe check (run by Profe between rounds)' }));
    const failed = result.criteria.filter((c) => c.status === 'failed').map((c) => c.id);
    const entry = {
      round,
      grade: result.grade,
      passed: result.passedCount,
      total: result.criteria.length,
      failed,
      unverified: result.criteria.filter((c) => c.status === 'unverified').map((c) => c.id),
      evidence: result.evidence,
      criteria: result.criteria.map(({ id, status, reason, failedStepTitle, testUrl }) => ({ id, status, reason, failedStepTitle, testUrl })),
    };
    rounds.push(entry);
    onRound({ kind: 'graded', ...entry });

    const done = failed.length === 0 && entry.unverified.length === 0;
    if (commit) {
      const label = round === 0 ? 'Initial grade' : `Re-grade after ${agentName} round ${round}`;
      const committed = gitCommit(
        appDir,
        `profe loop: ${label} for ${submission.student}: ${result.passedCount}/${result.criteria.length} criteria pass` +
          (failed.length ? ` (failing: ${failed.join(', ')})` : '') +
          '\n\nGraded by Kane CLI in a real Chrome. Feedback: profe-feedback.md',
      );
      entry.commit = committed.ok ? committed.sha : null;
    }
    if (done || result.kane.infraError || round >= maxRounds) {
      return { student: submission.student, agent: agentCommand, rounds, ok: done, infraError: result.kane.infraError };
    }

    onRound({ kind: 'agent-start', round: round + 1, agent: agentName, failed });
    const agent = await runAgent({ command: agentCommand, cwd: appDir, prompt: agentPrompt() });
    entry.agent = { round: round + 1, exitCode: agent.exitCode, durationS: agent.durationS, reply: lastLines(agent.output, 25) };
    onRound({ kind: 'agent-end', round: round + 1, agent: agentName, ...entry.agent });
    if (commit) {
      const committed = gitCommit(
        appDir,
        `${agentName} (round ${round + 1}): fix ${failed.join(', ')} for ${submission.student} from Kane's feedback\n\n${lastLines(agent.output, 12)}`,
      );
      entry.agent.commit = committed.ok ? committed.sha : null;
    }
  }
}

export function renderLoopTranscript(rubric, loop) {
  const lines = [
    `# Profe loop: ${loop.student}`,
    '',
    `**${rubric.title}** · agent: \`${loop.agent}\` · ${loop.ok ? '✅ every criterion passes' : '❌ stopped before every criterion passed'}`,
    '',
    '| Round | Grade | Passed | Failing | Commit |',
    '|---|---|---|---|---|',
    ...loop.rounds.map((r) => `| ${r.round} | ${r.grade} | ${r.passed}/${r.total} | ${r.failed.join(', ') || '–'} | ${r.commit ?? ''} |`),
  ];
  for (const r of loop.rounds) {
    lines.push('', `## Round ${r.round}: ${r.passed}/${r.total}`);
    for (const c of r.criteria.filter((x) => x.status !== 'passed')) {
      lines.push(`- ${c.status === 'failed' ? '❌' : '⚠️'} ${c.id}: ${c.reason ?? c.status}${c.failedStepTitle ? ` (step "${c.failedStepTitle}")` : ''}${c.testUrl ? ` · [run](${c.testUrl})` : ''}`);
    }
    if (r.agent) {
      lines.push('', `**Agent round ${r.agent.round}** (${r.agent.durationS} s, exit ${r.agent.exitCode})${r.agent.commit ? ` · commit ${r.agent.commit}` : ''}:`, '', '```text', r.agent.reply, '```');
    }
  }
  return `${lines.join('\n')}\n`;
}

function lastLines(text, n) {
  return String(text).trim().split('\n').slice(-n).join('\n');
}
