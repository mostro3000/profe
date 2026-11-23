#!/usr/bin/env node
// Builds the sample student submissions and the calibration mutants from the
// reference solution by injecting small, realistic bugs. Every bug is listed
// here and in examples/README.md, so anyone can check Profe's verdicts against
// a known answer key.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assignmentDir = join(root, 'assignments', 'course-enrollment');
const reference = readFileSync(join(assignmentDir, 'reference', 'index.html'), 'utf8');

// Each bug is a list of [find, replace] edits applied to the reference.
const BUGS = {
  duplicateEnroll: {
    breaks: 'AC3',
    note: 'Enroll button never switches to "Enrolled"; a second click enrolls again and takes another seat.',
    edits: [
      ["  if (state.enrolled.includes(id)) return say(`You are already enrolled in ${course.name}.`, 'error');\n", ''],
      [
        "    button.textContent = enrolled ? 'Enrolled' : 'Enroll';\n    button.disabled = enrolled || seats === 0;",
        "    button.textContent = 'Enroll';\n    button.disabled = seats === 0;",
      ],
    ],
  },
  dropKeepsSeat: {
    breaks: 'AC6',
    note: 'Drop removes the course but never gives the seat back.',
    edits: [['  state.seats[id] += 1;\n', '']],
  },
  noPersistence: {
    breaks: 'AC8',
    note: 'State is never written to localStorage, so a reload loses everything.',
    edits: [['  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));\n', '  // TODO: save to localStorage\n']],
  },
  caseSensitiveSearch: {
    breaks: 'AC7',
    note: 'Search compares raw strings, so "WEB" finds nothing.',
    edits: [[
      '  const visible = COURSES.filter((c) => c.name.toLowerCase().includes(q));',
      '  const visible = COURSES.filter((c) => c.name.includes(query.trim()));',
    ]],
  },
  noClashCheck: {
    breaks: 'AC5',
    note: 'No schedule-overlap check: Programming I and Databases can both be taken.',
    edits: [[
      "  const clash = state.enrolled.map(byId).find((c) => overlaps(c, course));\n  if (clash) return say(`Schedule clash: ${course.name} overlaps with ${clash.name}.`, 'error');\n",
      '',
    ]],
  },
  focusCrashOnDrop: {
    breaks: 'AC9',
    note: 'After a Drop the UI updates correctly, then focus() on a missing element throws a TypeError.',
    edits: [[
      "  say(`Dropped ${course.name}.`, 'ok');\n  render();\n}",
      "  say(`Dropped ${course.name}.`, 'ok');\n  render();\n  document.getElementById(`undo-${id}`).focus(); // move focus to the undo link\n}",
    ]],
  },
};

const STUDENTS = [
  { slug: 'bruno', name: 'Bruno', accent: '#0f766e', bugs: ['duplicateEnroll', 'dropKeepsSeat'] },
  { slug: 'carla', name: 'Carla', accent: '#7c3aed', bugs: ['noPersistence', 'caseSensitiveSearch'] },
  { slug: 'diego', name: 'Diego', accent: '#c2410c', bugs: ['noClashCheck', 'focusCrashOnDrop'] },
  { slug: 'elena', name: 'Elena', accent: '#be185d', bugs: [] },
];

const MUTANTS = [
  { slug: 'no-clash-check', bugs: ['noClashCheck'] },
  { slug: 'case-sensitive-search', bugs: ['caseSensitiveSearch'] },
];

function replaceOnce(source, find, replace, label) {
  const first = source.indexOf(find);
  if (first === -1 || source.indexOf(find, first + 1) !== -1) {
    throw new Error(`${label}: expected exactly one match for ${JSON.stringify(find.slice(0, 60))}`);
  }
  return source.slice(0, first) + replace + source.slice(first + find.length);
}

function build(bugNames, { accent, subtitle } = {}) {
  let html = reference;
  for (const name of bugNames) {
    for (const [find, replace] of BUGS[name].edits) html = replaceOnce(html, find, replace, name);
  }
  if (accent) html = replaceOnce(html, '--accent: #1a56db;', `--accent: ${accent};`, 'accent');
  if (subtitle) {
    html = replaceOnce(html, 'Semester 1 · Pick your courses for next semester', subtitle, 'subtitle');
  }
  return html;
}

function write(path, html) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
  console.log(`wrote ${path.slice(root.length + 1)}`);
}

for (const student of STUDENTS) {
  const html = build(student.bugs, { accent: student.accent, subtitle: `TP3 · ${student.name} · Pick your courses for next semester` });
  write(join(root, 'examples', 'submissions', student.slug, 'index.html'), html);
}
for (const mutant of MUTANTS) {
  write(join(assignmentDir, 'mutants', mutant.slug, 'index.html'), build(mutant.bugs));
}

console.log('\nAnswer key:');
for (const student of STUDENTS) {
  const broken = student.bugs.map((b) => `${BUGS[b].breaks} (${BUGS[b].note})`);
  console.log(`  ${student.name}: ${broken.length ? broken.join('; ') : 'no seeded bugs'}`);
}
