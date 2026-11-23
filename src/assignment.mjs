// Loading an assignment (rubric.json + one Kane test per criterion) and a
// roster of submissions.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function loadAssignment(dir) {
  const root = resolve(dir);
  const file = join(root, 'rubric.json');
  if (!existsSync(file)) throw new Error(`No rubric.json in ${dir}`);
  const rubric = JSON.parse(readFileSync(file, 'utf8'));
  if (!rubric.id || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    throw new Error(`${file}: needs an "id" and a non-empty "criteria" list`);
  }
  const seen = new Set();
  const criteria = rubric.criteria.map((criterion) => {
    if (!criterion.id || !criterion.test) throw new Error(`${file}: every criterion needs an "id" and a "test"`);
    if (seen.has(criterion.id)) throw new Error(`${file}: duplicate criterion id ${criterion.id}`);
    seen.add(criterion.id);
    const testPath = join(root, criterion.test);
    if (!testPath.endsWith('_test.md')) throw new Error(`${criterion.id}: test files must end in _test.md`);
    if (!existsSync(testPath)) throw new Error(`${criterion.id}: test not found: ${criterion.test}`);
    return {
      ...criterion,
      title: criterion.title ?? criterion.id,
      text: criterion.text ?? '',
      points: Number(criterion.points ?? 1),
      testPath,
      steps: parseStepHeadings(readFileSync(testPath, 'utf8')),
    };
  });
  return {
    ...rubric,
    title: rubric.title ?? rubric.id,
    scale: Number(rubric.scale ?? 10),
    dir: root,
    criteria,
    maxPoints: criteria.reduce((sum, c) => sum + c.points, 0),
  };
}

// The "## " headings of a _test.md file are its steps, in order.
export function parseStepHeadings(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

export function loadRoster(file) {
  const path = resolve(file);
  const roster = JSON.parse(readFileSync(path, 'utf8'));
  const base = dirname(path);
  return {
    assignmentDir: roster.assignment ? resolve(base, roster.assignment) : null,
    submissions: (roster.submissions ?? []).map((entry) => resolveSubmission(entry, base)),
  };
}

// A submission's app is a deployed http(s) URL or a folder with an index.html.
export function resolveSubmission({ student, app, email }, base = process.cwd()) {
  if (!student || !app) throw new Error('Each submission needs a "student" and an "app"');
  const common = { student, email: email ?? null, slug: slugify(student) };
  if (/^https?:\/\//i.test(app)) return { ...common, app, url: app };
  const dir = resolve(base, app);
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`${student}: no index.html in ${dir}`);
  return { ...common, app, dir };
}

export function slugify(text) {
  const slug = String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'submission';
}
