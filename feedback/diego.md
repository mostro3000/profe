# Profe feedback: Diego

**Assignment 3: Course Enrollment** · proposed grade **7.8 / 10** (7 of 9 criteria passed)

Checked on 2026-11-23 18:37 UTC in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.

| | Criterion | Result |
|---|---|---|
| ✅ | AC1 · Catalog | Passed |
| ✅ | AC2 · Enroll | Passed |
| ✅ | AC3 · No duplicates | Passed |
| ✅ | AC4 · Full courses | Passed |
| ❌ | AC5 · Schedule clash | Failed at "Check the rejection" |
| ✅ | AC6 · Drop | Passed |
| ✅ | AC7 · Search | Passed |
| ✅ | AC8 · Persistence | Passed |
| ❌ | AC9 · No runtime errors | Failed at "Use the app while watching for uncaught exceptions" |

## What to fix

### ❌ AC5 · Schedule clash

- **The criterion:** Enrolling in a course that overlaps one already in "My courses" is rejected with a message that names the conflicting course. Seats and "My courses" do not change.
- **What Kane saw:** Checkpoint assertion failed: "the page shows a message that mentions "Programming I""
- **Kane's diagnosis (a hypothesis: check it against the replay):** The page was still showing the starting enrollment state: its visible message says that Databases was enrolled, and Databases remains in My courses with only 1 seat available. The run performed no interaction to reach the state required by the checkpoint. Add the required enrollment or drop actions and wait for the page to update before asserting the message, that Databases is absent from My courses, and that it has 2 available seats.
- **Where:** the step "Check the rejection" in `tests/ac5_schedule_clash_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84V91TVBV03QKZQ9CD6R5RX/dashboard/share/US_2JV7HXE0SF2TAPIB63FR06E95V4CND9F0TDMCL9O183E3WP5IC23MFOD2PI8YV7T?type=summary&agentView=true&fqdn=summary-page

### ❌ AC9 · No runtime errors

- **The criterion:** Using the app never throws an uncaught JavaScript error.
- **What Kane saw:** Final verification failed: "the console recorded no uncaught JavaScript exceptions (console entries where is_exception is true) during this step"
- **Kane's diagnosis (a hypothesis: check it against the replay):** After the course is removed, the page tries to move focus to something that is no longer there. Update the drop action to check that the next focus target exists before focusing it, then repeat the enroll, drop, and search flow. evidence: console_error: Cannot read properties of null (reading 'focus')
- **Where:** the step "Use the app while watching for uncaught exceptions" in `tests/ac9_no_runtime_errors_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84VC6DAT4RP6TDZMHM2XGS8/dashboard/share/US_7JYCDSNRY6PSPCKPFAFWMY6RDHK4THPO23M8MWZ0LOB881HSFF4KFSXS3X9HNYD3?type=summary&agentView=true&fqdn=summary-page

## Check again after fixing

```bash
profe check assignments/course-enrollment --app <your app folder or URL>
```

## For your coding agent

If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:

> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run `profe check assignments/course-enrollment --app <your app folder or URL>`, read the new profe-feedback.md, and repeat until every criterion passes.
