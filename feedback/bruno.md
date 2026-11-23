# Profe feedback: Bruno

**Assignment 3: Course Enrollment** · proposed grade **7.8 / 10** (7 of 9 criteria passed)

Checked on 2026-11-23 18:33 UTC in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.

| | Criterion | Result |
|---|---|---|
| ✅ | AC1 · Catalog | Passed |
| ✅ | AC2 · Enroll | Passed |
| ❌ | AC3 · No duplicates | Failed at "Check the button and the list" |
| ✅ | AC4 · Full courses | Passed |
| ✅ | AC5 · Schedule clash | Passed |
| ❌ | AC6 · Drop | Failed at "Check the seat came back" |
| ✅ | AC7 · Search | Passed |
| ✅ | AC8 · Persistence | Passed |
| ✅ | AC9 · No runtime errors | Passed |

## What to fix

### ❌ AC3 · No duplicates

- **The criterion:** After enrolling in a course, its button reads "Enrolled" and is disabled, and the course appears only once in "My courses".
- **What Kane saw:** Checkpoint assertion failed: "the button for "Web Development" in the catalog reads "Enrolled" and is disabled"
- **Kane's diagnosis (a hypothesis: check it against the replay):** The catalog and My courses panel disagree about the student's enrollment. The course is already in My courses, but the catalog still treats it as available to enroll. Make the catalog refresh its enrollment status from the same enrollment record used by My courses. When Web Development is already listed there, show an Enrolled button and disable it. evidence: objective_contradiction: check FAILED: the button for "Web Development" in the catalog reads "Enrolled" — expected: Enrolled | observed: {{web_de evidence: objective_contradiction: check FAILED: the button for "Web Development" in the catalog is disabled — expected: false | observed: {{web_developmen
- **Where:** the step "Check the button and the list" in `tests/ac3_no_duplicates_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84TXZ50A8Q506BH4BZ0RJTM/dashboard/share/US_NDGZKACIY8GEJPEJ5IDW8K5SEBIDAMOHQCT6U2JT6XZGVSB6R7YL9NJZRWDVDYA2?type=summary&agentView=true&fqdn=summary-page

### ❌ AC6 · Drop

- **The criterion:** Clicking "Drop" removes the course from "My courses" and gives its seat back.
- **What Kane saw:** Final verification failed: "The catalog shows 1 available seat for "Computer Networks"."
- **Kane's diagnosis (a hypothesis: check it against the replay):** After the course was dropped, the app removed it from the student’s course list but did not add its seat back to the catalog. Fix the drop flow so it restores one available seat for the dropped course, then refreshes the catalog count and availability badge. evidence: objective_contradiction: check FAILED: The catalog shows 1 available seat for "Computer Networks". — expected: 1 | observed: {{computer_networks_
- **Where:** the step "Check the seat came back" in `tests/ac6_drop_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84V1S7R5DTA1RNFA6P2MW20/dashboard/share/US_5L0BL66V1ZDIK9BNA5S0XLNPD4E5DWNEH25LOQ07UW31ZH49HQRUOYYFMIASR5UD?type=summary&agentView=true&fqdn=summary-page

## Check again after fixing

```bash
profe check assignments/course-enrollment --app <your app folder or URL>
```

## For your coding agent

If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:

> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run `profe check assignments/course-enrollment --app <your app folder or URL>`, read the new profe-feedback.md, and repeat until every criterion passes.
