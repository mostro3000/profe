---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [ac5]
max_steps: 20
---

# AC5 Schedule clashes are rejected

## Enroll in Programming I
Click the "Enroll" button for "Programming I", then verify "Programming I" is listed under "My courses".

## Try a course at the same time
Click the "Enroll" button for "Databases".

## Check the rejection
Verify the page shows a message that mentions "Programming I".
Verify "Databases" is not listed under "My courses" and the catalog still shows 2 available seats for "Databases".
