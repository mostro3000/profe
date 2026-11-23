# Build log: how Kane shaped Profe

Profe was built with Claude Code as the coding agent, with Kane CLI running against the real thing at every step. This is the record of what Kane's runs showed and what changed because of them. Commit hashes are on the `main` history of this repo.

## 1. The rubric's first real run: the reference passes 9/9

The nine plain-English tests ran against the reference solution with `kane-cli testrun run … --override-start-url … --parallel 3`. Every test was authored on that first run. All nine passed in 4 min 50 s for about 435 credits. That run also showed the shapes Profe now relies on:

- `testrun run` wants `*_test.md` paths, not a folder. The first attempt died with `error: not a *_test.md file: tests`.
- Each test's own event log has a `run_end` per step, with Kane's summary and the values it read (`final_state`). It also has `test_md_step_end` with 1-based step indexes, and a public Test Manager `share_url`.
- The suite seals one consolidated evidence pack named after the execution, plus one pack per test.

## 2. Calibration said "Calibrated". Kane's evidence said otherwise

The first `profe calibrate` (reference + two mutants) printed **✓ Calibrated**: the reference passed 9/9, and both known bugs were caught. The run itself told a different story.

- **AC9 failed on the case-sensitive-search mutant, which throws nothing.** The evidence pack's `logs/0-console.ndjson` had a single entry: `Failed to load resource: 404` for `/favicon.ico`. The run log showed that Kane's console analyzer had generated `return len(console.errors()) > 0`, which counts any console error, not uncaught exceptions. On the reference run it had happened to pass. That is a flaky test, and it would have cost some student a point.
- **AC2 and AC3 "failed" on both mutants with `TargetClosedError: … browser has been closed`.** Nine Chromes were running at once. Those are harness errors, not student mistakes, and they were about to be graded as fails.

Changes (commit `df4184d`):

- AC9 now asks explicitly for uncaught exceptions (`is_exception`), and Profe's local server answers `/favicon.ico` with a quiet 204.
- Harness errors that Kane reports as failures (`TargetClosedError`, `net::ERR_*`, CDP errors) count as **unverified**. They are retried once and never cost points.
- **Calibration became strict.** Every mutant must pass every criterion it does not break. If a nearly-correct app fails a test, that test is wrong.

## 3. Strict calibration caught a second flaky test

The strict re-run recovered both harness errors on retry (AC9 on the reference, AC2 on a mutant). Then it refused to call the rubric calibrated:

```text
✗ Not calibrated. Fix these before grading anyone:
  - AC2 failed on mutants/no-clash-check, which only breaks AC5: the test is flaky or too strict.
      Kane: Final verification failed: "the course "Operating Systems" shows 4 available seats"
```

AC2's first step said "verify Operating Systems shows 4 seats, then click its Enroll button". Kane's final verification re-checks the whole objective after the step, when the course already shows 3 seats. The precondition now has its own step (commit `25cb65c`). The other eight tests only assert after they act, so none of them has this pattern.

The third calibration, with both fixes, came back clean and needed no retries:

| Run | Grade | Failed criteria |
|---|---|---|
| reference | 10 | none |
| mutants/no-clash-check | 8.9 | AC5 only |
| mutants/case-sensitive-search | 8.9 | AC7 only |

```text
Reference solution: 9/9 criteria passed
Known bugs caught:  2/2
✓ Calibrated: these tests can be trusted to grade students.
```

That run still graded two apps at a time. Section 4 explains why its verdict was later thrown away and the calibration was redone from scratch.

## 4. Two students at once: one test started on Bruno's app and finished on Carla's

The first full grading ran two submissions at a time. Bruno's AC2 failed with "Operating Systems is already enrolled; its catalog control is disabled and labeled Enrolled", which is impossible in Bruno's code: his seeded bug is that the button never says "Enrolled". The test's own event log explained it:

```text
step 1 · navigate: Navigate to http://127.0.0.1:43173/                  ← Bruno's app
run_end · final_state: { "url": "http://127.0.0.1:35501/", … }          ← Carla's app
```

Two `kane-cli testrun` processes on one machine launch Chrome on the same DevTools port range (9222–9230) and end up attached to each other's browsers. The same cross-talk explains the `TargetClosedError`s seen while calibrating with concurrency above 1. The very first single-process run had none.

The run was stopped, its workspaces deleted, and Profe now runs one `testrun` at a time (commit `04d5f41`). Parallelism stays inside each testrun (`--parallel`), where Kane coordinates its own workers.

### The cross-talk had also left a poisoned recording behind

Re-validating the calibration one testrun at a time failed AC2 on the reference solution. Kane's own diagnosis of the failed run:

> The page was still in its initial state: My courses was empty and Operating Systems still had 4 seats. […] no enrollment action occurred.

The recording of the step "Enroll in Operating Systems" replayed with `actions_executed: 0`. It had been authored during the concurrent calibration, while the click landed in another process's Chrome. Adaptive heal could not fix it, because an empty step "passes" its replay.

Recordings authored under cross-talk cannot be trusted. `profe --fresh` now passes Kane's `--author` to re-author every step, and the calibration was re-run from scratch.

## 5. Calibrated from scratch, then the class

Calibration was redone with `--fresh` (every step authored again), one testrun at a time. Reference: 9/9. no-clash-check: fails only AC5. case-sensitive-search: fails only AC7. **✓ Calibrated.**

Then the five example submissions were graded one at a time, each in 4 to 5 minutes with three Chrome workers. No check needed a retry:

| Submission | Grade | Kane failed | Answer key |
|---|---|---|---|
| Bruno | 7.8 | AC3, AC6 | AC3, AC6 ✓ |
| Carla | 7.8 | AC7, AC8 | AC7, AC8 ✓ |
| Diego | 7.8 | AC5, AC9 | AC5, AC9 ✓ |
| Elena | 10 | none | none ✓ |
| Sofi (Claude Haiku, one shot) | 10 | none | unknown on purpose |

Calibration and grading together cost about 1,630 credits.

Diego's AC9 is the case a screenshot misses. His app looks right after a Drop, and Kane's diagnosis named the exact seeded bug: "the page tries to move focus to something that has already been removed … `Cannot read properties of null (reading 'focus')`".

Two more runs closed the picture:

- **The closed loop, for real.** `profe loop` with Claude Haiku as the student's agent took a copy of Bruno's app from 7/9 to 9/9 in one round. The agent spent 17 seconds and fixed exactly the two bugs Kane reported (see [`agent-loop/`](agent-loop/README.md)).
- **Kane checks the dashboard.** `npm run selftest` passed: grades table, evidence drill-down, export refused until a grade is approved, then approve and export.

### Verdicts versus diagnoses

Every verdict was right. One diagnosis was not. For Diego's AC5, Kane blamed "the wrong starting enrollment data … reset Diego's enrollments", when the app had simply accepted a clashing course. A student following that advice would look in the wrong place. Feedback now labels Kane's diagnosis as *a hypothesis to check against the replay*. The verdict and what Kane read on the page are the evidence.

### What is safe to share

The evidence packs contain the grader's TestMu account details: the account email and organization id in `result.yaml`, and the profile in the logs. Profe's report says so, and the sample report in this repo ships without packs. The public Test Manager replays carry no account email.

## 6. Lessons, now built into Profe

1. A grader needs a grader. The reference solution alone would not have caught either flaky test; strict mutants did.
2. "Failed" from a browser agent is not always the student's failure. Read why it failed before taking points away.
3. Put a precondition in its own step. Kane re-verifies each step's whole objective when the step ends.
4. Check where the browser actually was. Kane's `final_state.url` caught a cross-talk bug that no assertion would have.
5. A passing replay is not proof of an action. After an infrastructure incident, re-author (`--fresh`) instead of trusting old recordings.
6. Trust the verdict, check the diagnosis. Show students what failed and what was read on the page; present the root-cause story as a hypothesis.
