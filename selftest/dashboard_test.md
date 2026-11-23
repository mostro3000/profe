---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [selftest]
max_steps: 25
---

# Profe dashboard works end to end

## Grades table
Verify the page heading reads "Assignment 3: Course Enrollment".
Verify the grades table has one row each for "Bruno", "Carla", "Diego" and "Elena".

## Open the evidence for a failed criterion
In Bruno's row, click the red ✗ cell in the AC3 column.
Verify Bruno's "AC3 · No duplicates" entry is shown expanded and includes the text "What Kane saw".

## Export needs an approval first
Scroll back to the grades table and click the "Export approved grades (CSV)" button.
Verify the page shows the message "Tick Approve on at least one row first."

## Approve one grade and export it
In Elena's row, tick the Approve checkbox, then click the "Export approved grades (CSV)" button.
Verify the page shows the message "Exported 1 approved grade(s)."
