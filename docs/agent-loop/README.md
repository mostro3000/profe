# The closed loop, for real, with two different agents

In each run, Kane grades a copy of a seeded submission, a coding agent reads Profe's feedback and fixes the app, and Kane grades it again. Two runs were recorded, each with a different agent and a different student.

| Student | Agent | Round 0 (Kane) | Agent time | Round 1 (Kane) |
|---|---|---|---|---|
| Bruno | Claude Haiku 5.5 (`claude -p`) | **7/9**: AC3, AC6 fail | 17 s | **9/9** |
| Diego | Muse, model `muse-spark-1.3-contributor` (`muse exec`) | **7/9**: AC5, AC9 fail | 36 s | **9/9** |

## Bruno, with Claude Haiku

```bash
profe loop assignments/course-enrollment --app ./demo-student-bruno --name Bruno \
  --agent "claude -p --model haiku --permission-mode acceptEdits" --rounds 3
```

What Kane reported in round 0 is exactly what the agent fixed:

- **AC3:** `the button for "Web Development" in the catalog reads "Enrolled" and is disabled` failed. The agent made the button read "Enrolled" and disabled it once the course is taken, and `enroll()` now refuses a second enrollment.
- **AC6:** `The catalog shows 1 available seat for "Computer Networks"` failed. The agent made `drop()` give the seat back.

Files: [`profe-loop.md`](bruno/profe-loop.md) (the transcript, with the agent's own reply), [`fix.diff`](bruno/fix.diff), [`after/index.html`](bruno/after/index.html) and [`final-feedback.md`](bruno/final-feedback.md).

## Diego, with Muse

```bash
profe loop assignments/course-enrollment --app ./demo-student-diego --name Diego \
  --agent "muse exec --model muse-spark-1.3-contributor --contributor-mode on" --rounds 3
```

Diego's harder bug never shows on screen: after a Drop the page looks right, then throws an uncaught `TypeError`. The agent fixed it from Kane's console evidence alone:

- **AC5:** `the page shows a message that mentions "Programming I"` failed. The agent added the missing overlap check, which rejects the course with a message naming the conflict.
- **AC9:** the console recorded an uncaught exception. The agent traced it to `.focus()` on an element that does not exist (`Cannot read properties of null`) and guarded the call.

Files: [`profe-loop.md`](diego-muse/profe-loop.md), [`fix.diff`](diego-muse/fix.diff), [`after/index.html`](diego-muse/after/index.html) and [`final-feedback.md`](diego-muse/final-feedback.md).

## What both runs show

- **Both fixes target the real bugs.** Each is two or three small edits, and nothing in either diff special-cases a test, a course name or a seat count.
- **The agent only edits files.** Kane, the network and the TestMu credentials stay with Profe, outside the agent's sandbox. The agent's prompt tells it not to run the grader itself.
- **Any agent CLI fits.** The `--agent` command is plain text, and any CLI that takes a prompt and edits files in its working folder works. The two above are the ones we recorded. Codex has the same shape (`codex exec --approve-for-me`) but was not run here.
