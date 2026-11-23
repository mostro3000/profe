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

Changes (commit `7ebbdb5`):

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

AC2's first step said "verify Operating Systems shows 4 seats, then click its Enroll button". Kane's final verification re-checks the whole objective after the step, when the course already shows 3 seats. The precondition now has its own step (commit `ba1b9a2`). The other eight tests only assert after they act, so none of them has this pattern.

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

The three calibrations cost about 830 credits in total. The result is in [`assignments/course-enrollment/calibration.json`](../assignments/course-enrollment/calibration.json).

## 4. Two students at once: one test started on Bruno's app and finished on Carla's

The first full grading ran two submissions at a time. Bruno's AC2 failed with "Operating Systems is already enrolled; its catalog control is disabled and labeled Enrolled", which is impossible in Bruno's code: his seeded bug is that the button never says "Enrolled". The test's own event log explained it:

```text
step 1 · navigate: Navigate to http://127.0.0.1:43173/                  ← Bruno's app
run_end · final_state: { "url": "http://127.0.0.1:35501/", … }          ← Carla's app
```

Two `kane-cli testrun` processes on one machine launch Chrome on the same DevTools port range (9222–9230) and end up attached to each other's browsers. The same cross-talk explains the `TargetClosedError`s seen while calibrating with concurrency above 1. The very first single-process run had none.

The run was stopped, its workspaces deleted, and Profe now runs one `testrun` at a time (commit `7cca3dd`). Parallelism stays inside each testrun (`--parallel`), where Kane coordinates its own workers. Calibration was then re-validated sequentially.

## 5. Lessons, now built into Profe

1. A grader needs a grader. The reference solution alone would not have caught either flaky test; strict mutants did.
2. "Failed" from a browser agent is not always the student's failure. Read why it failed before taking points away.
3. Put a precondition in its own step. Kane re-verifies each step's whole objective when the step ends.
4. Check where the browser actually was. Kane's `final_state.url` caught a cross-talk bug that no assertion would have.
