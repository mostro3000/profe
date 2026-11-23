import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadAssignment, parseStepHeadings, resolveSubmission, slugify } from '../src/assignment.mjs';
import { calibrate, gradeSubmission, prepareWorkspace, score } from '../src/grade.mjs';
import { summarize } from '../src/kane.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const rubric = loadAssignment(join(root, 'assignments', 'course-enrollment'));
process.env.PROFE_KANE_BIN = `${process.execPath} ${join(root, 'test', 'fake-kane.mjs')}`;

function scenario(content) {
  const dir = mkdtempSync(join(tmpdir(), 'profe-test-'));
  const file = join(dir, 'scenario.json');
  writeFileSync(file, JSON.stringify(content));
  process.env.FAKE_KANE_SCENARIO = file;
  return dir;
}

test('loads the rubric with one test and its steps per criterion', () => {
  assert.equal(rubric.criteria.length, 9);
  assert.equal(rubric.maxPoints, 9);
  const ac3 = rubric.criteria.find((c) => c.id === 'AC3');
  assert.deepEqual(ac3.steps, ['Enroll in Web Development', 'Try to enroll again', 'Check the button and the list']);
  assert.deepEqual(parseStepHeadings('# T\n\n## One\nbody\n## Two\n'), ['One', 'Two']);
});

test('slugs and submissions resolve folders and URLs', () => {
  assert.equal(slugify('María José Núñez'), 'maria-jose-nunez');
  assert.equal(resolveSubmission({ student: 'A', app: 'https://a.example/tp3/' }).url, 'https://a.example/tp3/');
  assert.throws(() => resolveSubmission({ student: 'B', app: 'does/not/exist' }), /no index.html/);
});

test('workspace copies tests and puts the student name in each title', () => {
  const workRoot = mkdtempSync(join(tmpdir(), 'profe-work-'));
  const { work, testFiles } = prepareWorkspace({ rubric, slug: 'bruno', label: 'Bruno', workRoot });
  assert.equal(testFiles.length, 9);
  const copy = readFileSync(join(work, 'tests', 'ac2_enroll_test.md'), 'utf8');
  assert.match(copy, /^# AC2 Enroll takes exactly one seat · Bruno$/m);
  assert.match(copy, /target: chrome/);
});

test('grades a submission: failed criteria cost points, with the failing step named', async () => {
  const workRoot = scenario({
    bruno: {
      'ac3_no_duplicates_test.md': { status: 'failed', message: 'Button still reads "Enroll"', step_index: 3 },
      'ac6_drop_test.md': {
        status: 'failed',
        message: 'Catalog shows 0 seats, expected 1',
        step_index: 3,
        observed: { 'Computer Networks available seats': '0' },
      },
    },
  });
  const submission = resolveSubmission({ student: 'Bruno', app: join(root, 'examples', 'submissions', 'bruno') });
  const result = await gradeSubmission({ rubric, submission, workRoot });
  assert.equal(result.passedCount, 7);
  assert.equal(result.failedCount, 2);
  assert.equal(result.grade, 7.8);
  assert.equal(result.needsReview, false);
  const ac3 = result.criteria.find((c) => c.id === 'AC3');
  assert.equal(ac3.status, 'failed');
  assert.equal(ac3.reason, 'Button still reads "Enroll"');
  assert.equal(ac3.failedStep, 3);
  assert.equal(ac3.failedStepTitle, 'Check the button and the list');
  assert.equal(ac3.testUrl, 'https://example.test/share/bruno/ac3_no_duplicates_test.md');
  assert.ok(existsSync(ac3.evidencePack), 'the per-criterion evidence pack is found');
  const ac6 = result.criteria.find((c) => c.id === 'AC6');
  assert.deepEqual(ac6.observed, { 'Computer Networks available seats': '0' });
  assert.ok(result.evidence.endsWith('exec-bruno.evidence'), 'the consolidated pack is picked by id');
  const ac1 = result.criteria.find((c) => c.id === 'AC1');
  assert.equal(ac1.failedStepTitle, null);
});

test('a broken run is unverified: it never costs points and flags the grade for review', async () => {
  const workRoot = scenario({ carla: { 'ac8_persistence_test.md': { status: 'broken', message: 'Chrome crashed' } } });
  const submission = resolveSubmission({ student: 'Carla', app: join(root, 'examples', 'submissions', 'carla') });
  const result = await gradeSubmission({ rubric, submission, workRoot });
  assert.equal(result.unverifiedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.needsReview, true);
});

test('an infrastructure failure is reported, not graded as a fail', async () => {
  const workRoot = scenario({ diego: 'crash' });
  const submission = resolveSubmission({ student: 'Diego', app: join(root, 'examples', 'submissions', 'diego') });
  const result = await gradeSubmission({ rubric, submission, workRoot });
  assert.equal(result.failedCount, 0);
  assert.equal(result.unverifiedCount, 9);
  assert.match(result.kane.infraError, /not signed in/);
});

test('calibration flags a test that fails the reference and one that misses a known bug', async () => {
  const workRoot = scenario({
    reference: { 'ac4_full_course_test.md': { status: 'failed', message: 'Could not find the Full label', step_index: 1 } },
    'mutant-no-clash-check': { 'ac5_schedule_clash_test.md': { status: 'failed', message: 'Databases was enrolled' } },
    // mutant-case-sensitive-search: every test passes, so AC7 misses the bug.
  });
  const result = await calibrate({ rubric, workRoot });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.problems.map((p) => `${p.criterion}:${p.kind}`),
    ['AC4:fails-on-reference', 'AC7:misses-known-bug'],
  );
  assert.equal(result.problems[0].step, 'Check the full course');
});

test('summarize keeps the latest end event per test file', () => {
  const s = summarize([
    { type: 'testrun_start', execution_id: 'x1' },
    { type: 'testrun_member_end', path: '/abs/tests/a_test.md', status: 'failed' },
    { type: 'testrun_authored_member_end', path: 'tests/a_test.md', status: 'passed' },
    { type: 'testrun_done', overall_status: 'passed' },
  ]);
  assert.equal(s.executionId, 'x1');
  assert.equal(s.members.get('a_test.md').status, 'passed');
});

test('score rounds to one decimal on the rubric scale', () => {
  const criteria = [
    { points: 1, status: 'passed' },
    { points: 1, status: 'passed' },
    { points: 1, status: 'failed' },
  ];
  assert.equal(score(criteria, 10).grade, 6.7);
});
