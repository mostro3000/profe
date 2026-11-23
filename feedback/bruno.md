# Profe feedback: Bruno

**Assignment 3: Course Enrollment** · proposed grade **7.8 / 10** (7 of 9 criteria passed)

Checked on 2026-11-23 17:13 UTC in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.

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
- **What Kane saw:** Checkpoint assertion failed: "The button for "Web Development" in the catalog reads "Enrolled" and is disabled."
- **Kane's diagnosis (a hypothesis: check it against the replay):** The catalog and My courses are showing conflicting enrollment information for the same course. The course is already listed as selected, yet the catalog still treats it as available, including all 4 seats. Make the catalog use the same enrollment record as My courses. For an enrolled course, display a disabled Enrolled button and update its available-seat count consistently. evidence: objective_contradiction: check FAILED: The button for "Web Development" in the catalog reads "Enrolled". — expected: Enrolled | observed: {{web_d evidence: objective_contradiction: check FAILED: The button for "Web Development" in the catalog is disabled. — expected: false | observed: {{web_developme
- **Where:** the step "Check the button and the list" in `tests/ac3_no_duplicates_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84PCNE3RDR43RQ255P219F6/dashboard/share/US_TL2RMNS05NF2QZ0K0BRI3ZWKFKINTI7OSPK8QRMHKH0UVGWF4HSOC63NGXMGDNOC?type=summary&agentView=true&fqdn=summary-page

### ❌ AC6 · Drop

- **The criterion:** Clicking "Drop" removes the course from "My courses" and gives its seat back.
- **What Kane saw:** Final verification failed: "The catalog shows 1 available seat for "Computer Networks"."
- **Kane's diagnosis (a hypothesis: check it against the replay):** After the course was dropped, the app removed it from the student’s list but did not add the released seat back to the catalog. Update the drop operation so it returns one seat to Computer Networks and refreshes the catalog count after the drop. evidence: objective_contradiction: check FAILED: The catalog shows 1 available seat for "Computer Networks". — expected: 1 | observed: {{computer_networks_ evidence: objective_contradiction: check FAILED: "Computer Networks" is no longer listed under "My courses". — expected: false | observed: {{computer_netwo
- **Where:** the step "Check the seat came back" in `tests/ac6_drop_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84PFRARV91V4EZR41TMK690/dashboard/share/US_65OY3R7UH6E1WSEVSTW2O7XBDEHTGU27FDNS8MFAG9JUXXU4QQB5BRY1UMPXNIGW?type=summary&agentView=true&fqdn=summary-page

## Check again after fixing

```bash
profe check assignments/course-enrollment --app <your app folder or URL>
```

## For your coding agent

If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:

> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run `profe check assignments/course-enrollment --app <your app folder or URL>`, read the new profe-feedback.md, and repeat until every criterion passes.
