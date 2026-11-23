---
mode: testing
target: chrome
url: http://127.0.0.1:4173/
tags: [ac9]
max_steps: 20
---

# AC9 No runtime errors

## Use the app while watching for uncaught exceptions
Click the "Enroll" button for "Web Development", then under "My courses" click the "Drop" button next to "Web Development", then type "net" into the "Search courses" box.
Assert: the console recorded no uncaught JavaScript exceptions (console entries where is_exception is true) during this step. Other console errors, such as a resource that failed to load, are not exceptions and do not count.
