# KaneCLI Online Hackathon: submission draft

Team: **Profe** · Deadline: 26 Nov 2026, 11:59 PM IST

## 1. GitHub URL

https://github.com/mostro3000/profe (created after 12 Nov; full history public)

## 2. About your app

**What we built.** Profe is a teaching assistant that actually runs students' web apps. Students now hand in apps written with Claude Code, Cursor or Codex, and they look finished. A teacher with 120 submissions cannot click through each one, so grades end up based on screenshots and code reading.

Profe works in four steps:

1. The teacher's acceptance criteria become plain-English Kane CLI tests, one `_test.md` per criterion.
2. Profe **calibrates** those tests: the reference solution must pass every one, and known-bad mutants must fail exactly the criteria they break.
3. Profe **grades** every submission in a real Chrome, with one isolated browser per criterion and one sealed evidence pack per student. Every verdict links to a public Test Manager share page.
4. Profe proposes a grade, and the teacher approves it. Approved grades export as a CSV that imports into a Moodle gradebook.

Students and their coding agents get the same checks with `profe check`. `profe loop` closes the loop: Kane grades, the agent reads the feedback and fixes the app, and Kane grades again.

**Which agent.**

- Profe was built with **Claude Code (Claude Opus 5.5)**, with Kane CLI running against the real thing at every step.
- The student-side agent in the demo is **Claude Haiku 5.5**, driven by `profe loop --agent "claude -p …"`.
- Any agent CLI works, Codex included (`codex exec --approve-for-me`). The agent only edits files; Kane stays outside its sandbox.

**What Kane does.**

- One `kane-cli testrun run --override-start-url <student app>` per submission.
- A DevTools console assertion: an app that looks right but throws a `TypeError` fails AC9.
- Evidence packs and public share links for every verdict.
- Calibration of the grader itself.
- Kane also tests Profe's own dashboard (`npm run selftest`).

**What Kane caught.** Kane caught Profe's own grader bugs before any student paid for them. The first calibration said "Calibrated". The evidence packs showed a console check counting a missing favicon as a JS error, and a step whose precondition Kane re-verified after the click. Both are fixed, and calibration is now strict (see `docs/BUILD-LOG.md`).

## 3. Demo video

YouTube link: (record from `docs/launch/VIDEO.md`)

## 4. Live URL

Optional: the sample dashboard on GitHub Pages.

## 5. Launch buzz

At least two public posts: drafts in `docs/launch/POSTS.md`.
