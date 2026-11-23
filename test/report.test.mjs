import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadAssignment } from '../src/assignment.mjs';
import { score } from '../src/grade.mjs';
import { csvCell, esc, renderFeedback, writeReport } from '../src/report.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const rubric = loadAssignment(join(root, 'assignments', 'course-enrollment'));

function fakeResult(student, failing = {}) {
  const criteria = rubric.criteria.map((c) => {
    const fail = failing[c.id];
    return {
      id: c.id,
      title: c.title,
      text: c.text,
      points: c.points,
      test: c.test,
      status: fail ? (fail.status ?? 'failed') : 'passed',
      kaneStatus: fail ? (fail.status ?? 'failed') : 'passed',
      reason: fail?.reason ?? null,
      failedStep: fail ? 1 : null,
      failedStepTitle: fail ? 'Check the result' : null,
      summary: null,
      testUrl: `https://example.test/${c.id}`,
      durationS: 20,
      logPath: '/secret/local/path.ndjson',
    };
  });
  return {
    student,
    slug: student.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    email: `${student.toLowerCase().replace(/[^a-z]/g, '')}@example.edu`,
    app: 'submissions/x',
    url: null,
    gradedAt: '2026-11-23T18:00:00.000Z',
    criteria,
    ...score(criteria, 10),
    evidence: null,
    workDir: '/secret/work',
    kane: { exitCode: 1, infraError: null, errors: [] },
  };
}

test('writes report.json, grades.csv, feedback and the dashboard', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'profe-report-'));
  const results = [fakeResult('Bruno', { AC3: { reason: 'Button still reads Enroll' } }), fakeResult('Elena')];
  const paths = writeReport({ rubric, results, outDir });
  for (const file of [paths.html, paths.json, paths.csv, join(outDir, 'feedback', 'bruno.md')]) assert.ok(existsSync(file), file);

  const report = JSON.parse(readFileSync(paths.json, 'utf8'));
  assert.equal(report.students.length, 2);
  assert.ok(!JSON.stringify(report).includes('/secret/'), 'local paths stay out of the shared report');

  const csv = readFileSync(paths.csv, 'utf8').trim().split('\n');
  assert.equal(csv[0], 'student,email,proposed_grade,passed,failed,unverified,needs_review,failed_criteria');
  assert.equal(csv[1], 'Bruno,bruno@example.edu,8.9,8,1,0,no,AC3');

  const html = readFileSync(paths.html, 'utf8');
  assert.match(html, /Export approved grades/);
  assert.match(html, /href="#bruno-ac3"/);
});

test('feedback names what failed and tells the coding agent how to re-check', () => {
  const md = renderFeedback(rubric, fakeResult('Bruno', { AC6: { reason: 'Catalog shows 0 seats, expected 1' } }), {
    checkCommand: 'profe check assignments/course-enrollment --app .',
  });
  assert.match(md, /### ❌ AC6 · Drop/);
  assert.match(md, /What Kane saw:\*\* Catalog shows 0 seats, expected 1/);
  assert.match(md, /For your coding agent/);
  assert.match(md, /profe check assignments\/course-enrollment --app \./);
});

test('unverified checks are explained as not counting against the student', () => {
  const md = renderFeedback(rubric, fakeResult('Carla', { AC8: { status: 'unverified' } }));
  assert.match(md, /never count against you/);
  assert.match(md, /⚠️ \| AC8 · Persistence \| Could not run/);
});

test('escaping: student names cannot inject HTML or break the CSV', () => {
  assert.equal(esc('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  assert.equal(csvCell('Pérez, "Juan"'), '"Pérez, ""Juan"""');
  const outDir = mkdtempSync(join(tmpdir(), 'profe-report-'));
  const paths = writeReport({ rubric, results: [fakeResult('<img src=x onerror=alert(1)>')], outDir });
  assert.ok(!readFileSync(paths.html, 'utf8').includes('<img src=x'));
});
