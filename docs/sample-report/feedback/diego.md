# Profe feedback: Diego

**Assignment 3: Course Enrollment** · proposed grade **7.8 / 10** (7 of 9 criteria passed)

Checked on 2026-11-23 17:22 UTC in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.

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
- **What Kane saw:** Final verification failed: ""Databases" is not listed under "My courses" and the catalog still shows 2 available seats for "Databases""
- **Kane's diagnosis (a hypothesis: check it against the replay):** The run used the wrong starting enrollment data. Databases was already in My courses, so its available-seat count was already reduced from two to one. Reset Diego's course enrollments before this test, or use a fresh student whose only relevant enrollment state matches the scenario.
- **Where:** the step "Check the rejection" in `tests/ac5_schedule_clash_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84PZ4KYVZJ8NZQF97TBRA5T/dashboard/share/US_ZKSDZ03A7OJDBE6DUJ2ZB1WM426CFN69ECHA13Z27WOK68K279BF7JMVQQMBQ72Z?type=summary&agentView=true&fqdn=summary-page

### ❌ AC9 · No runtime errors

- **The criterion:** Using the app never throws an uncaught JavaScript error.
- **What Kane saw:** Final verification failed: "the console recorded no uncaught JavaScript exceptions (console entries where is_exception is true) during this step"
- **Kane's diagnosis (a hypothesis: check it against the replay):** After the course is dropped, the page tries to move focus to something that has already been removed from the page. Update the drop flow to check that the intended focus target still exists before focusing it, then add a test that drops a course and verifies no uncaught errors occur. evidence: console_error: Cannot read properties of null (reading 'focus')
- **Where:** the step "Use the app while watching for uncaught exceptions" in `tests/ac9_no_runtime_errors_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84Q2M670PQQVCWXDGEGDP9S/dashboard/share/US_98HSMRPST30DAA0MC3GVIVRYGYM4GS9Z18R3A5XYJ6QBFNT85LKCQFW0VXKP2HLB?type=summary&agentView=true&fqdn=summary-page

## Check again after fixing

```bash
profe check assignments/course-enrollment --app <your app folder or URL>
```

## For your coding agent

If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:

> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run `profe check assignments/course-enrollment --app <your app folder or URL>`, read the new profe-feedback.md, and repeat until every criterion passes.
