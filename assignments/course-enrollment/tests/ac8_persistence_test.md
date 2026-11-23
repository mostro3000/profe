---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [ac8]
max_steps: 20
---

# AC8 Enrollments survive a reload

## Enroll in Operating Systems
Click the "Enroll" button for "Operating Systems", then verify it is listed under "My courses".

## Reload the page
Reload the page.

## Check nothing was lost
Verify "Operating Systems" is still listed under "My courses".
Verify the catalog shows 3 available seats for "Operating Systems".
