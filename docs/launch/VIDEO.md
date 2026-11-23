# Demo video script (about 4 minutes, voiceover)

The judges' own guidance: lead with the Kane run report, show one real flow, and say what Kane caught. Record the screen at 1080p and speed up the waits.

## 0:00–0:20 · Lead with the Kane report

**Screen:** `reports/demo/index.html`. The grades matrix with red ✗ cells. Hover Diego's AC9 cell.

**Voice:** "This is Kane CLI grading five students' web apps in a real Chrome. Diego's app looks perfect on screen, but Kane caught an uncaught TypeError every time you drop a course. A screenshot would never show that. I'm a developer at a public university IT department, and this is Profe."

## 0:20–0:50 · The problem

**Screen:** the assignment (`assignments/course-enrollment/assignment.md`), then the five submission folders.

**Voice:** "Students now hand in apps built with Claude Code, Cursor or Codex. They look finished. A teacher with 120 of them can't click through every one, so grades end up based on screenshots. Profe turns each acceptance criterion into a plain-English Kane test and runs it against every student's app."

## 0:50–1:40 · Who grades the grader? (what Kane caught)

**Screen:** `profe calibrate` in the terminal, then `docs/BUILD-LOG.md`, then the console log from the evidence pack.

**Voice:** "Before grading anyone, Profe calibrates the rubric. The reference solution must pass all nine tests, and apps with known bugs must fail exactly what they break. My first calibration said 'Calibrated'. Kane's evidence pack said otherwise. A console check was counting a missing favicon as a JavaScript error, and it would have cost a student a point. Strict calibration then caught a second flaky test. Both are fixed. Kane caught my grader's bugs before any student paid for them."

## 1:40–2:40 · Grading, with evidence for every point

**Screen:** `profe grade examples/roster.json` (sped up). Then the dashboard:

1. Click Bruno's AC3 ✗.
2. Read "What Kane saw".
3. Open the Test Manager share link and play the autoplay.
4. Show Sofi's row.

**Voice:** "One testrun per student, one isolated Chrome per criterion, one sealed evidence pack per student. Every red cell says which step failed, what Kane read on the page, and links to a public replay. Sofi's app was written in one shot by Claude Haiku and nobody reviewed it. Here is what Kane found: [result]."

## 2:40–3:30 · Closing the loop with the student's agent

**Screen:** `profe loop … --agent "claude -p …"` on Bruno's app: round 0 at 7/9, the agent's reply, round 1 at 9/9. Then `profe-loop.md`.

**Voice:** "Students get the same checks. `profe loop` hands Kane's feedback to any coding agent, here Claude Haiku. The agent fixes the app, and Kane grades it again. Seven out of nine became nine out of nine, and every round is recorded."

## 3:30–4:00 · The teacher decides; Kane checks Profe too

**Screen:** tick Approve, then Export CSV. Then `npm run selftest`, where Kane checks the dashboard itself.

**Voice:** "Profe proposes and the teacher decides. Checks that could not run never cost points, and approved grades export straight into Moodle. Kane even tests Profe's own dashboard. Every point has evidence. Profe: the teaching assistant that actually runs your students' apps."
