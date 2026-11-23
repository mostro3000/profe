---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [ac4]
max_steps: 20
---

# AC4 Full courses cannot be taken

## Check the full course
Verify the course "Software Engineering" shows 0 available seats and the label "Full".

## Try to enroll
If the "Enroll" button for "Software Engineering" can be clicked, click it. Otherwise do nothing.

## Check nothing changed
Verify "Software Engineering" is not listed under "My courses".
