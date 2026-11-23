// Reports: report.json (machine), grades.csv (gradebook import), one
// feedback.md per student (for the student and their coding agent), and a
// self-contained HTML dashboard for the teacher.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const VERSION = '0.1.0';
const ICON = { passed: '✅', failed: '❌', unverified: '⚠️' };
const MARK = { passed: '✓', failed: '✗', unverified: '?' };
const WORD = { passed: 'Passed', failed: 'Failed', unverified: 'Could not run' };

export function writeReport({ rubric, results, calibration = null, outDir }) {
  mkdirSync(join(outDir, 'feedback'), { recursive: true });
  const students = results.map((result) => {
    let evidenceFile = null;
    if (result.evidence && existsSync(result.evidence)) {
      mkdirSync(join(outDir, 'evidence'), { recursive: true });
      evidenceFile = `evidence/${result.slug}.evidence`;
      copyFileSync(result.evidence, join(outDir, evidenceFile));
    }
    const feedbackFile = `feedback/${result.slug}.md`;
    writeFileSync(join(outDir, feedbackFile), renderFeedback(rubric, result));
    return { ...publicResult(result), evidenceFile, feedbackFile };
  });
  const report = {
    tool: 'profe',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    assignment: {
      id: rubric.id,
      title: rubric.title,
      scale: rubric.scale,
      criteria: rubric.criteria.map(({ id, title, text, points, test }) => ({ id, title, text, points, test })),
    },
    calibration: calibration ? summarizeCalibration(calibration) : null,
    students,
  };
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outDir, 'grades.csv'), renderCsv(report));
  writeFileSync(join(outDir, 'index.html'), renderHtml(report));
  return {
    dir: outDir,
    html: join(outDir, 'index.html'),
    json: join(outDir, 'report.json'),
    csv: join(outDir, 'grades.csv'),
  };
}

// Local paths (work dirs, Kane logs) stay out of shared reports.
export function publicResult(result) {
  const { workDir, evidence, ...rest } = result;
  return { ...rest, criteria: result.criteria.map(({ logPath, evidencePack, ...c }) => c) };
}

export function summarizeCalibration(calibration) {
  if (calibration.summary) return calibration;
  const reference = calibration.runs.find((r) => r.role === 'reference')?.result;
  const mutants = calibration.runs.filter((r) => r.role === 'mutant');
  const expected = mutants.flatMap((m) => m.mustFail.map((id) => ({ app: m.result.app, id, status: m.result.criteria.find((c) => c.id === id)?.status })));
  return {
    assignment: calibration.assignment,
    calibratedAt: calibration.calibratedAt,
    ok: calibration.ok,
    problems: calibration.problems,
    summary: {
      referencePassed: reference ? reference.passedCount : 0,
      referenceTotal: reference ? reference.criteria.length : 0,
      knownBugsCaught: expected.filter((e) => e.status === 'failed').length,
      knownBugsTotal: expected.length,
    },
    runs: calibration.runs.map((run) => ({
      role: run.role,
      app: run.result.app,
      mustFail: run.mustFail,
      grade: run.result.grade,
      criteria: run.result.criteria.map(({ id, status, reason, failedStepTitle, testUrl }) => ({ id, status, reason, failedStepTitle, testUrl })),
    })),
  };
}

// ---------------------------------------------------------------- feedback.md

export function renderFeedback(rubric, result, { checkCommand } = {}) {
  const command = checkCommand ?? `profe check assignments/${rubric.id} --app <your app folder or URL>`;
  const total = result.criteria.length;
  const lines = [
    `# Profe feedback: ${result.student}`,
    '',
    `**${rubric.title}** · proposed grade **${result.grade} / ${result.scale ?? rubric.scale}** (${result.passedCount} of ${total} criteria passed)`,
    '',
    `Checked on ${formatDate(result.gradedAt)} in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.`,
  ];
  if (result.kane?.infraError) {
    lines.push('', `> ⚠️ Kane could not run the checks: ${result.kane.infraError}. Nothing here counts against you; your teacher will look at it.`);
  } else if (result.needsReview) {
    lines.push('', '> ⚠️ Some checks could not run. They never count against you: your teacher will look at them.');
  }
  lines.push('', '| | Criterion | Result |', '|---|---|---|');
  for (const c of result.criteria) {
    const detail =
      c.status === 'failed' && c.failedStepTitle ? `Failed at "${c.failedStepTitle}"` : WORD[c.status];
    lines.push(`| ${ICON[c.status]} | ${c.id} · ${c.title} | ${escapeTable(detail)} |`);
  }

  const failed = result.criteria.filter((c) => c.status === 'failed');
  if (failed.length) {
    lines.push('', '## What to fix');
    for (const c of failed) {
      lines.push('', `### ❌ ${c.id} · ${c.title}`, '', `- **The criterion:** ${c.text}`);
      if (c.reason) lines.push(`- **What Kane saw:** ${oneLine(c.reason)}`);
      if (c.observed) lines.push(`- **What Kane read on the page:** ${observedText(c.observed)}`);
      if (c.summary && c.summary !== c.reason) lines.push(`- **Kane's account of the run:** ${oneLine(c.summary)}`);
      if (c.failedStepTitle) lines.push(`- **Where:** the step "${c.failedStepTitle}" in \`${c.test}\``);
      if (c.testUrl) lines.push(`- **Watch the run:** ${c.testUrl}`);
    }
  } else if (!result.needsReview) {
    lines.push('', '## 🎉 Every criterion passed', '', 'Nothing to fix.');
  }

  lines.push(
    '',
    '## Check again after fixing',
    '',
    '```bash',
    command,
    '```',
    '',
    '## For your coding agent',
    '',
    'If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:',
    '',
    `> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run \`${command}\`, read the new profe-feedback.md, and repeat until every criterion passes.`,
    '',
  );
  return lines.join('\n');
}

// ------------------------------------------------------------------ grades.csv

export function renderCsv(report) {
  const header = ['student', 'email', 'proposed_grade', 'passed', 'failed', 'unverified', 'needs_review', 'failed_criteria'];
  const rows = report.students.map((s) => [
    s.student,
    s.email ?? '',
    s.grade,
    s.passedCount,
    s.failedCount,
    s.unverifiedCount,
    s.needsReview ? 'yes' : 'no',
    s.criteria.filter((c) => c.status === 'failed').map((c) => c.id).join(' '),
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ----------------------------------------------------------------- index.html

export function renderHtml(report) {
  const { assignment, students, calibration } = report;
  const criteria = assignment.criteria;
  const average = students.length ? students.reduce((sum, s) => sum + s.grade, 0) / students.length : 0;
  const reviewCount = students.filter((s) => s.needsReview).length;
  const passRates = criteria.map((c) => {
    const verified = students.filter((s) => statusOf(s, c.id) !== 'unverified');
    const passed = verified.filter((s) => statusOf(s, c.id) === 'passed').length;
    return { ...c, passed, verified: verified.length };
  });
  const hardest = [...passRates].filter((c) => c.verified).sort((a, b) => a.passed / a.verified - b.passed / b.verified)[0];

  const calibrationCard = calibration
    ? calibration.ok
      ? card('Rubric calibrated', '✓', `The reference solution passes ${calibration.summary.referencePassed}/${calibration.summary.referenceTotal} criteria, and ${calibration.summary.knownBugsCaught}/${calibration.summary.knownBugsTotal} known bugs were caught.`, 'ok')
      : card('Rubric not calibrated', '!', `${calibration.problems.length} problem(s): ${calibration.problems.map((p) => p.criterion).join(', ')}. Fix the tests before trusting these grades.`, 'bad')
    : card('Rubric calibration', '–', 'Not run yet. Run <code>profe calibrate</code> before grading.', 'warn');

  const head = criteria
    .map((c) => `<th scope="col" title="${esc(`${c.id} · ${c.title}: ${c.text}`)}"><span>${esc(c.id)}</span><small>${esc(c.title)}</small></th>`)
    .join('');
  const rows = students
    .map((s) => {
      const cells = criteria
        .map((c) => {
          const cr = s.criteria.find((x) => x.id === c.id);
          const status = cr?.status ?? 'unverified';
          return `<td><a class="cell ${status}" href="#${esc(s.slug)}-${esc(c.id.toLowerCase())}" title="${esc(`${s.student} · ${c.id} ${c.title}: ${WORD[status]}`)}">${MARK[status]}</a></td>`;
        })
        .join('');
      return `<tr data-student="${esc(s.student)}" data-email="${esc(s.email ?? '')}">
  <th scope="row"><a href="#${esc(s.slug)}">${esc(s.student)}</a>${s.needsReview ? ' <span class="flag" title="Some checks could not run">review</span>' : ''}</th>${cells}
  <td class="num">${fmt(s.grade)}</td>
  <td><input class="final" type="number" inputmode="decimal" min="0" max="${assignment.scale}" step="0.1" value="${fmt(s.grade)}" aria-label="Final grade for ${esc(s.student)}"></td>
  <td><input class="approve" type="checkbox" aria-label="Approve the grade for ${esc(s.student)}"></td>
</tr>`;
    })
    .join('\n');

  const insights = passRates
    .map((c) => {
      const pct = c.verified ? Math.round((100 * c.passed) / c.verified) : 0;
      return `<li><span class="crit">${esc(c.id)} · ${esc(c.title)}</span><span class="bar" role="img" aria-label="${pct}% passed"><span style="width:${pct}%"></span></span><span class="num">${c.passed}/${c.verified}</span></li>`;
    })
    .join('\n');

  const details = students.map((s) => renderStudent(s, assignment)).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profe · ${esc(assignment.title)}</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #f7f6f2; --surface: #ffffff; --ink: #1d1d1b; --muted: #66645e; --line: #e6e3dc;
  --pass: #1e7a3d; --pass-bg: #e3f4e8; --fail: #b42318; --fail-bg: #fde8e6; --warn: #8a5a00; --warn-bg: #fff3d1;
  --accent: #1a56db;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #141413; --surface: #1e1e1c; --ink: #f0eee8; --muted: #a8a59c; --line: #34332f;
    --pass: #7ad19a; --pass-bg: #173523; --fail: #ff8f85; --fail-bg: #3b1714; --warn: #f3c560; --warn-bg: #3a2d0c;
    --accent: #8fb0ff;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 28px 16px 56px; }
a { color: var(--accent); }
header .brand { font-weight: 800; letter-spacing: .02em; color: var(--accent); }
h1 { margin: 2px 0 4px; font-size: 1.7rem; }
h2 { margin: 36px 0 12px; font-size: 1.15rem; }
.meta { color: var(--muted); margin: 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 20px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.card .label { color: var(--muted); font-size: .85rem; }
.card .value { font-size: 1.6rem; font-weight: 700; margin: 2px 0; }
.card p { margin: 0; font-size: .9rem; color: var(--muted); }
.card.ok .value { color: var(--pass); } .card.bad .value { color: var(--fail); } .card.warn .value { color: var(--warn); }
.table-scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
table { border-collapse: collapse; width: 100%; min-width: 760px; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: center; }
thead th { font-size: .8rem; vertical-align: bottom; }
thead th span { display: block; font-weight: 700; }
thead th small { display: block; color: var(--muted); font-weight: 400; }
tbody th { text-align: left; white-space: nowrap; }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
.cell { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; font-weight: 800; text-decoration: none; }
.cell.passed { background: var(--pass-bg); color: var(--pass); }
.cell.failed { background: var(--fail-bg); color: var(--fail); }
.cell.unverified { background: var(--warn-bg); color: var(--warn); }
.num { font-variant-numeric: tabular-nums; font-weight: 700; }
input.final { width: 4.5em; font: inherit; padding: 4px 6px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); }
input.approve { width: 18px; height: 18px; }
.flag { font-size: .7rem; font-weight: 700; color: var(--warn); background: var(--warn-bg); border-radius: 999px; padding: 1px 7px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 12px; }
.actions button { font: inherit; font-weight: 700; border: 0; border-radius: 10px; padding: 9px 14px; background: var(--accent); color: #fff; cursor: pointer; }
.actions .hint { color: var(--muted); font-size: .9rem; }
ul.insights { list-style: none; margin: 0; padding: 14px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; display: grid; gap: 8px; }
ul.insights li { display: grid; grid-template-columns: minmax(140px, 1fr) 2fr 3.5em; gap: 12px; align-items: center; }
.bar { display: block; height: 10px; border-radius: 999px; background: var(--fail-bg); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--pass); }
.student { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 14px; }
.student > header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.student h3 { margin: 0; font-size: 1.1rem; }
.student .links { color: var(--muted); font-size: .9rem; }
.student ol { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; }
.student li { border: 1px solid var(--line); border-radius: 10px; }
.student li:target, .student li.flash { outline: 2px solid var(--accent); }
.student summary { cursor: pointer; padding: 8px 12px; list-style: none; display: flex; gap: 8px; align-items: baseline; }
.student summary::-webkit-details-marker { display: none; }
.student summary .why { color: var(--muted); font-size: .9rem; }
.student .body { padding: 0 12px 12px 38px; font-size: .92rem; }
.student .body p { margin: 6px 0; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 1px 5px; }
footer { margin-top: 40px; color: var(--muted); font-size: .9rem; border-top: 1px solid var(--line); padding-top: 14px; }
@media (max-width: 640px) { ul.insights li { grid-template-columns: 1fr 3.5em; } ul.insights .bar { grid-column: 1 / -1; grid-row: 2; } }
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="brand">Profe</div>
  <h1>${esc(assignment.title)}</h1>
  <p class="meta">Graded ${esc(formatDate(report.generatedAt))} · ${students.length} submission(s) · ${criteria.length} criteria · every check ran in a real Chrome with Kane CLI</p>
</header>

<section class="cards" aria-label="Summary">
  ${card('Average proposed grade', `${fmt(average)}<small>/${assignment.scale}</small>`, `${students.filter((s) => s.failedCount === 0 && !s.needsReview).length} of ${students.length} submissions pass every criterion.`)}
  ${calibrationCard}
  ${card('Most missed', hardest ? esc(hardest.id) : '–', hardest ? `${esc(hardest.title)}: ${hardest.verified - hardest.passed} of ${hardest.verified} submissions failed it.` : 'Nothing failed.')}
  ${card('Needs your review', String(reviewCount), reviewCount ? 'Some checks could not run. They never count against the student.' : 'Every check produced a verdict.', reviewCount ? 'warn' : '')}
</section>

<h2>Grades</h2>
<div class="table-scroll">
<table>
<thead><tr><th scope="col">Student</th>${head}<th scope="col">Proposed</th><th scope="col">Final</th><th scope="col">Approve</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
<div class="actions">
  <button id="export" type="button">Export approved grades (CSV)</button>
  <span class="hint" id="export-status">Adjust a final grade if you disagree, tick Approve, then export. The CSV imports into a Moodle gradebook (Grades › Import › CSV file).</span>
</div>

<h2>Class insights</h2>
<ul class="insights">
${insights}
</ul>

<h2>Evidence, student by student</h2>
${details}

<footer>
  Profe proposes and the teacher decides: no grade leaves this page without a human approving it. A check marked <strong>?</strong> could not run (the app was down, the browser crashed); it never counts against the student.
  Generated by Profe ${esc(report.version)} with Kane CLI. Each evidence pack opens with <code>kane-cli evidence serve &lt;file&gt;</code>.
</footer>
</div>
<script>
const rows = [...document.querySelectorAll('tbody tr[data-student]')];
const status = document.getElementById('export-status');
const cell = (v) => (/[",\\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
document.getElementById('export').addEventListener('click', () => {
  const approved = rows.filter((row) => row.querySelector('.approve').checked);
  if (!approved.length) {
    status.textContent = 'Tick Approve on at least one row first.';
    return;
  }
  const lines = ['student,email,grade'].concat(
    approved.map((row) => [row.dataset.student, row.dataset.email, row.querySelector('.final').value].map(cell).join(',')),
  );
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([lines.join('\\n') + '\\n'], { type: 'text/csv' }));
  link.download = 'approved-grades.csv';
  link.click();
  status.textContent = 'Exported ' + approved.length + ' approved grade(s).';
});
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  const details = target.matches('details') ? target : target.querySelector('details');
  if (details) details.open = true;
  document.querySelectorAll('.flash').forEach((el) => el.classList.remove('flash'));
  target.classList.add('flash');
}
window.addEventListener('hashchange', openFromHash);
openFromHash();
</script>
</body>
</html>
`;
}

function renderStudent(s, assignment) {
  const items = s.criteria
    .map((c) => {
      const why =
        c.status === 'failed'
          ? c.failedStepTitle
            ? `failed at "${c.failedStepTitle}"`
            : 'failed'
          : c.status === 'unverified'
            ? 'could not run, never counts against the student'
            : 'passed';
      const body = [
        `<p>${esc(c.text)}</p>`,
        c.reason ? `<p><strong>What Kane saw:</strong> ${esc(c.reason)}</p>` : '',
        c.observed && c.status !== 'passed' ? `<p><strong>What Kane read on the page:</strong> ${esc(observedText(c.observed))}</p>` : '',
        c.summary && c.summary !== c.reason ? `<p><strong>Kane's account:</strong> ${esc(c.summary)}</p>` : '',
        c.testUrl ? `<p><a href="${esc(c.testUrl)}" target="_blank" rel="noopener">Watch this run in Test Manager ↗</a></p>` : '',
        `<p class="links">Test: <code>${esc(c.test)}</code>${c.durationS ? ` · ${Math.round(c.durationS)} s` : ''}</p>`,
      ].join('');
      return `<li id="${esc(s.slug)}-${esc(c.id.toLowerCase())}"><details${c.status === 'passed' ? '' : ' open'}><summary>${ICON[c.status]} <strong>${esc(c.id)} · ${esc(c.title)}</strong> <span class="why">${esc(why)}</span></summary><div class="body">${body}</div></details></li>`;
    })
    .join('');
  const links = [
    `<a href="${esc(s.feedbackFile)}">feedback.md</a>`,
    s.evidenceFile ? `evidence pack: <code>kane-cli evidence serve ${esc(s.evidenceFile)}</code>` : 'no evidence pack',
    s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">app ↗</a>` : `app: <code>${esc(s.app)}</code>`,
  ].join(' · ');
  const infra = s.kane?.infraError ? `<p class="links">⚠️ ${esc(s.kane.infraError)}</p>` : '';
  return `<section class="student" id="${esc(s.slug)}">
<header><h3>${esc(s.student)}</h3><span class="num">${fmt(s.grade)} / ${assignment.scale}</span><span class="links">${s.passedCount} passed · ${s.failedCount} failed${s.unverifiedCount ? ` · ${s.unverifiedCount} could not run` : ''}</span></header>
<p class="links">${links}</p>${infra}
<ol>${items}</ol>
</section>`;
}

function card(label, value, text, tone = '') {
  return `<div class="card ${tone}"><div class="label">${label}</div><div class="value">${value}</div><p>${text}</p></div>`;
}

function statusOf(student, id) {
  return student.criteria.find((c) => c.id === id)?.status ?? 'unverified';
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : Number(n).toFixed(1);
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function oneLine(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function observedText(observed) {
  return Object.entries(observed)
    .map(([key, value]) => `${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('; ');
}

function escapeTable(text) {
  return String(text).replace(/\|/g, '\\|');
}
