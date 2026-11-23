# The closed loop, for real

Kane grades a copy of Bruno's submission. A coding agent reads Profe's feedback and fixes the app. Kane grades it again.

```bash
profe loop assignments/course-enrollment --app ./demo-student-bruno --name Bruno \
  --agent "claude -p --model haiku --permission-mode acceptEdits" --rounds 3
```

| Round | Who | What happened | Result |
|---|---|---|---|
| 0 | Kane | Graded the submission in a real Chrome, one isolated browser per criterion | **7/9**: AC3 and AC6 fail |
| 1 | Claude Haiku 5.5 | Read `profe-feedback.md` and `ASSIGNMENT.md`, edited `index.html` (17 s) | 3 changes, see [`bruno/fix.diff`](bruno/fix.diff) |
| 1 | Kane | Graded the fixed app | **9/9** |

What Kane reported in round 0 is exactly what the agent fixed:

- **AC3:** `the button for "Web Development" in the catalog reads "Enrolled" and is disabled` failed. The agent made the button read "Enrolled" and disabled it once the course is taken, and `enroll()` now refuses a second enrollment.
- **AC6:** `The catalog shows 1 available seat for "Computer Networks"` failed. The agent made `drop()` give the seat back.

The fix is three small changes to the real bugs. It does not special-case the tests: nothing in the diff mentions a test, a course name or a seat count.

How the agent was set up:

- **Only files.** The agent edits files in the app folder. Kane, the network and the TestMu credentials stay with Profe, outside the agent's sandbox. The agent's prompt tells it not to run the grader itself.
- **Any agent CLI.** The command is plain text: any CLI that takes a prompt and edits files in its working folder fits, for example `--agent "codex exec --approve-for-me"`. Only the Claude run above was recorded.

Files:

- [`bruno/profe-loop.md`](bruno/profe-loop.md): the transcript Profe wrote, with every round and the agent's own reply.
- [`bruno/fix.diff`](bruno/fix.diff): the seeded submission versus the agent's fix.
- [`bruno/after/index.html`](bruno/after/index.html): the fixed app.
- [`bruno/final-feedback.md`](bruno/final-feedback.md): the feedback after round 1, where every criterion passed.
