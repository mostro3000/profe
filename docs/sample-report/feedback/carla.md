# Profe feedback: Carla

**Assignment 3: Course Enrollment** · proposed grade **7.8 / 10** (7 of 9 criteria passed)

Checked on 2026-11-23 17:18 UTC in a real Chrome browser with Kane CLI. Your teacher reviews this grade before it is published.

| | Criterion | Result |
|---|---|---|
| ✅ | AC1 · Catalog | Passed |
| ✅ | AC2 · Enroll | Passed |
| ✅ | AC3 · No duplicates | Passed |
| ✅ | AC4 · Full courses | Passed |
| ✅ | AC5 · Schedule clash | Passed |
| ✅ | AC6 · Drop | Passed |
| ❌ | AC7 · Search | Failed at "Search in lowercase" |
| ❌ | AC8 · Persistence | Failed at "Check nothing was lost" |
| ✅ | AC9 · No runtime errors | Passed |

## What to fix

### ❌ AC7 · Search

- **The criterion:** Typing in the search box filters the catalog by course name, ignoring upper and lower case. Clearing it shows all courses again.
- **What Kane saw:** Final verification failed: ""Databases" is shown in the catalog and "Operating Systems" is not."
- **Kane's diagnosis (a hypothesis: check it against the replay):** The course search is not applying the matching filter correctly: after the correct search text is entered, it removes the matching course along with the non-matching courses. Fix the Search courses filter so a query such as “data” keeps matching courses, including Databases, visible and excludes non-matches such as Operating Systems. evidence: objective_contradiction: check FAILED: "Databases" is shown in the catalog. — expected: true | observed: {{databases_shown_in_catalog}} evidence: objective_contradiction: check FAILED: "Operating Systems" is not shown in the catalog. — expected: false | observed: {{operating_systems_shown_i
- **Where:** the step "Search in lowercase" in `tests/ac7_search_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84PSTB4KPNGV02BDBA55FJY/dashboard/share/US_X9PDDLVL6T26ESYLZNVNSHKIEBM6Z6Z3691YZ2V3IC3XVVEXPO9L0LJ95Z2H1JG3?type=summary&agentView=true&fqdn=summary-page

### ❌ AC8 · Persistence

- **The criterion:** Enrollments and seat counts survive a page reload.
- **What Kane saw:** Checkpoint assertion failed: ""Operating Systems" is still listed under "My courses"."
- **Kane's diagnosis (a hypothesis: check it against the replay):** The expected starting course enrollment was missing. The run only analyzed the page and then checked for the course; it did not perform an enrollment action that could have added it. Reset or seed the test account so Operating Systems is already under My courses and the catalog has 3 seats before running this verification.
- **Where:** the step "Check nothing was lost" in `tests/ac8_persistence_test.md`
- **Watch the run:** https://test-manager.lambdatest.com/projects/01M84JGRMYEEY6EAEDA44D61YJ/test-cases/01M84PT218EBRDHMAHVTG96859/dashboard/share/US_1NOM99CO8IDP2I0PU53KXUHXG5UG0684ORY4D7W85SFB5IE7BBA928TPBGJ6YH6P?type=summary&agentView=true&fqdn=summary-page

## Check again after fixing

```bash
profe check assignments/course-enrollment --app <your app folder or URL>
```

## For your coding agent

If you work with a coding agent (Claude Code, Codex, Cursor…), give it the assignment and this file, and ask:

> Fix the app so that every ❌ criterion in profe-feedback.md passes. Do not change the starting data or the labels required by the assignment's UI contract. After each change, run `profe check assignments/course-enrollment --app <your app folder or URL>`, read the new profe-feedback.md, and repeat until every criterion passes.
