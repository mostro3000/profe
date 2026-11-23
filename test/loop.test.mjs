import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadAssignment, resolveSubmission } from '../src/assignment.mjs';
import { agentEnv, agentPrompt, closedLoop, renderLoopTranscript } from '../src/loop.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const rubric = loadAssignment(join(root, 'assignments', 'course-enrollment'));
process.env.PROFE_KANE_BIN = `${process.execPath} ${join(root, 'test', 'fake-kane.mjs')}`;

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'profe-loop-'));
  const app = join(base, 'app');
  mkdirSync(app);
  copyFileSync(join(root, 'examples', 'submissions', 'bruno', 'index.html'), join(app, 'index.html'));
  const scenarioFile = join(base, 'scenario.json');
  writeFileSync(
    scenarioFile,
    JSON.stringify({
      'bruno-loop': {
        'ac3_no_duplicates_test.md': { status: 'failed', message: 'Button still reads "Enroll"', step_index: 3 },
        'ac6_drop_test.md': { status: 'failed', message: 'Catalog shows 0 seats, expected 1', step_index: 3 },
      },
    }),
  );
  process.env.FAKE_KANE_SCENARIO = scenarioFile;
  return { base, app };
}

test('the loop grades, hands the feedback to the agent, and re-grades until everything passes', async () => {
  const { base, app } = setup();
  const events = [];
  const loop = await closedLoop({
    rubric,
    submission: resolveSubmission({ student: 'Bruno', app }),
    agentCommand: `${process.execPath} ${join(root, 'test', 'fake-agent.mjs')}`,
    agentName: 'fake-agent',
    maxRounds: 3,
    workRoot: join(base, 'work'),
    onRound: (e) => events.push(e.kind),
  });
  assert.equal(loop.ok, true);
  assert.equal(loop.rounds.length, 2);
  assert.deepEqual(loop.rounds[0].failed, ['AC3', 'AC6']);
  assert.equal(loop.rounds[0].grade, 7.8);
  assert.match(loop.rounds[0].agent.reply, /Fixed AC3, AC6/);
  assert.equal(loop.rounds[1].grade, 10);
  assert.deepEqual(events, ['graded', 'agent-start', 'agent-end', 'graded']);
  assert.ok(existsSync(join(app, 'ASSIGNMENT.md')), 'the agent gets the assignment next to the app');
  assert.ok(existsSync(join(base, 'work', 'course-enrollment', 'bruno-loop')), 'the loop has its own Kane workspace');
  assert.ok(!existsSync(join(base, 'work', 'course-enrollment', 'bruno')), "the class grading's workspace is untouched");
  assert.match(readFileSync(join(app, 'profe-feedback.md'), 'utf8'), /Every criterion passed/);
  const transcript = renderLoopTranscript(rubric, loop);
  assert.match(transcript, /\| 0 \| 7\.8 \| 7\/9 \| AC3, AC6 \|/);
  assert.match(transcript, /\| 1 \| 10 \| 9\/9 \| – \|/);
});

test('the loop stops after the last allowed round', async () => {
  const { base, app } = setup();
  const loop = await closedLoop({
    rubric,
    submission: resolveSubmission({ student: 'Bruno', app }),
    agentCommand: `${process.execPath} -e "process.exit(0)"`,
    maxRounds: 1,
    workRoot: join(base, 'work'),
  });
  assert.equal(loop.ok, false);
  assert.equal(loop.rounds.length, 2);
});

test('the agent runs without the parent coding-agent session variables', () => {
  const env = agentEnv({ PATH: '/bin', HOME: '/home/x', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_JOB_DIR: '/j', ANTHROPIC_API_KEY: 'k' });
  assert.deepEqual(Object.keys(env).sort(), ['ANTHROPIC_API_KEY', 'HOME', 'PATH']);
});

test('the agent prompt points at the feedback and keeps the grader out of the agent', () => {
  const prompt = agentPrompt();
  assert.match(prompt, /profe-feedback\.md/);
  assert.match(prompt, /do not run the grader yourself/);
});
