# Example submissions

Sample student submissions for [Assignment 3](../assignments/course-enrollment/assignment.md), used by `profe demo`.

## Seeded submissions (the answer key)

These four are built from the reference solution by [`scripts/seed-examples.mjs`](../scripts/seed-examples.mjs). That script injects small bugs that students really make. The bugs are listed here so you can check Profe's verdicts against a known answer.

| Submission | Seeded bugs | Criteria that should fail |
|---|---|---|
| `bruno` | The Enroll button never turns into "Enrolled", so a second click enrolls again. Drop never gives the seat back. | AC3, AC6 |
| `carla` | Nothing is saved to `localStorage`. Search is case-sensitive. | AC8, AC7 |
| `diego` | No schedule-clash check. After a Drop, a `focus()` on a missing element throws a `TypeError` (the page still looks right). | AC5, AC9 |
| `elena` | None. | none |

Regenerate them with `node scripts/seed-examples.mjs`.

## The roster

[`roster.json`](roster.json) lists who submitted what. Each `app` is either a folder with an `index.html` (Profe serves it locally) or a deployed `https://` URL.
