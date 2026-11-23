# Profe

**The teaching assistant that actually runs your students' apps.**

Students now hand in web apps written with Claude Code, Cursor or Codex. They *look* finished. A teacher with 120 submissions cannot click through every one, so grades end up based on screenshots and code reading, and a broken feature that looks right goes unnoticed.

Profe turns an assignment's acceptance criteria into plain-English [Kane CLI](https://github.com/LambdaTest/kane-cli) tests, runs them in a real Chrome against every student's app, and proposes a grade **criterion by criterion, with evidence for every point**: screenshots of each step, console and network logs, a public link to watch the run, and a sealed evidence pack. The teacher reviews and approves every grade. Profe never publishes one on its own.

```text
assignment.md ─► rubric.json + tests/ac*_test.md   (one plain-English Kane test per criterion)
                      │
   profe calibrate ───┤  the reference solution must pass every test, and known-bad
                      │  mutants must fail the criteria they break ("who grades the grader?")
                      ▼
 roster.json ─► profe grade ─► per student: serve the app on a fresh port ─► kane-cli testrun
                      │         (one isolated Chrome per criterion, one sealed evidence pack)
                      ▼
   report: dashboard · grades.csv for the gradebook · feedback.md per student
                      │
 student ◄────────────┴─► profe check / profe loop: the student's coding agent reads the
                          feedback, fixes the app, and Kane grades it again until it passes
```

## Try it

You need Node 18+, Google Chrome, and Kane CLI signed in to a TestMu AI account (new accounts get free credits):

```bash
npm install -g @testmuai/kane-cli
kane-cli login

git clone https://github.com/mostro3000/profe && cd profe
node bin/profe.mjs demo
```

`demo` first calibrates the example rubric, then grades four example submissions and writes `reports/demo/index.html`. Each criterion's test is authored by Kane on its first run, so a full demo on a fresh account takes about 15 minutes and roughly 3,000 credits. Later runs replay the recordings and cost far less. To try it cheaply, grade one student:

```bash
node bin/profe.mjs grade examples/roster.json --only Bruno
```

## Commands

| Command | What it does |
|---|---|
| `profe calibrate <assignment>` | Runs the tests against the reference solution (must pass 9/9) and against mutants with known bugs (must fail what they break). Writes `calibration.json`. |
| `profe grade <roster.json>` | Grades every submission (a folder or an `https://` URL) and writes the report: `index.html`, `report.json`, `grades.csv`, `feedback/<student>.md`, `evidence/<student>.evidence`. |
| `profe check <assignment> --app <folder\|url>` | The student's self-check with the same tests. Writes `profe-feedback.md`, which is written for a coding agent too. |
| `profe loop <assignment> --app <folder> --agent "<cmd>"` | Closed loop: grade, give the feedback to a coding agent, grade again, until every criterion passes. Add `--commit` to put every round in git. |

`profe loop` works with any agent CLI, because the agent only edits files. Kane, the network and the TestMu credentials stay with Profe, outside the agent's sandbox:

```bash
profe loop assignments/course-enrollment --app ./my-app --agent "codex exec --approve-for-me" --commit
profe loop assignments/course-enrollment --app ./my-app --agent "claude -p --permission-mode acceptEdits"
```

## How Profe uses Kane CLI

- **One `kane-cli testrun run` per submission** over the assignment's `_test.md` files, with `--override-start-url` pointing at that student's app. Kane gives each criterion its own isolated Chrome and seals one evidence pack for the whole submission.
- **A fresh browser origin per run.** Local submissions are served on an ephemeral `127.0.0.1` port, so no `localStorage` leaks from one student to the next.
- **Plain-English tests written against the spec, not the DOM.** The same nine tests grade any implementation: plain JS, React, a table layout or cards.
- **DevTools assertions** catch what a screenshot cannot. AC9 fails an app that looks right but throws an uncaught `TypeError` in the console.
- **Kane's own words in the feedback:** the failing step, Kane's reason, the values it read on the page (`final_state`), and the public Test Manager link to the run.
- **Calibration with known answers** before any student is graded.

Every criterion in the report links to its run in Test Manager. The share links open without an account and show each step, each assertion and an autoplay of the screenshots.

## Kane caught Profe's own bugs

Profe was built with Claude Code, with Kane running against the real thing at every step. Its first calibration said "Calibrated". Kane's evidence packs then showed two flaky tests that would each have cost some student a point:

- a console check that counted a missing favicon as a JavaScript error;
- a step whose precondition Kane re-verified after the click.

Profe now refuses to grade until the reference solution and every mutant behave exactly as expected. The full story, with commits, is in [docs/BUILD-LOG.md](docs/BUILD-LOG.md).

## Fairness rules

1. **Only a real pass or a real fail counts.** A test that could not run (the app was down, the browser crashed) is marked *unverified*. It never costs points, and it sends the grade to the teacher.
2. **The rubric is calibrated before it grades anyone.** A test that fails the reference solution is a broken test, not a student's mistake.
3. **Every point has evidence**, and the teacher approves every grade. The dashboard has a "Final" column to override and an "Approve" checkbox. Only approved grades export to `approved-grades.csv`, which imports into a Moodle gradebook.

## Write your own assignment

```text
assignments/<id>/
  assignment.md          the spec students read
  rubric.json            criteria: id, title, text, points, test; plus calibration paths
  tests/acN_*_test.md    one Kane test per criterion (target: chrome, plain-English steps)
  reference/index.html   your solution: must pass every criterion
  mutants/<name>/        known-bad versions: each must fail the criteria listed in rubric.json
```

Run `profe calibrate assignments/<id>` until it says "Calibrated", then grade.

## The example

[`assignments/course-enrollment`](assignments/course-enrollment/assignment.md) is a second-year web development assignment: a course-enrollment page with seats, schedule clashes, search and persistence, graded on nine criteria. [`examples/`](examples/README.md) has four submissions with documented, seeded bugs (the answer key), so you can check Profe's verdicts yourself.

## Tests

```bash
npm test   # unit tests against a fake kane-cli: no browser, no credits
```

## License

MIT
