---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [ac7]
max_steps: 20
---

# AC7 Search ignores upper and lower case

## Search in lowercase
Type "data" into the "Search courses" box.
Verify "Databases" is shown in the catalog and "Operating Systems" is not.

## Search in uppercase
Clear the search box, then type "WEB" into it.
Verify "Web Development" is shown in the catalog and "Databases" is not.

## Clear the search
Clear the search box.
Verify all six courses are shown in the catalog again.
