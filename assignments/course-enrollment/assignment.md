# Assignment 3: Course Enrollment

*Web Development, 2nd year · Individual · Deliver a static web app (HTML/CSS/JS, any framework).*

Build a single-page app where a student enrolls in next semester's courses.

## Starting data

The app must start with exactly these six courses:

| Course | Schedule | Seats |
|---|---|---|
| Programming I | Mon 08:00–10:00 | 3 |
| Databases | Mon 09:00–11:00 | 2 |
| Computer Networks | Tue 14:00–16:00 | 1 |
| Operating Systems | Wed 10:00–12:00 | 4 |
| Software Engineering | Thu 16:00–18:00 | 0 |
| Web Development | Fri 18:00–20:00 | 5 |

## UI contract

Your app can look however you like, but use these labels so graders can find things:

- a heading **"My courses"** above the list of courses you are enrolled in;
- each course in the catalog has a button labeled **"Enroll"**. Once you are enrolled in it, the button reads **"Enrolled"** and is disabled;
- each course in "My courses" has a button labeled **"Drop"**;
- a course with no seats left shows the label **"Full"**;
- a search box with the placeholder **"Search courses"**;
- messages are shown on the page, not in `alert()` pop-ups.

## Acceptance criteria (this is how you are graded)

| ID | Criterion |
|---|---|
| AC1 | **Catalog.** The page lists the six courses, each with its name, schedule and number of available seats. |
| AC2 | **Enroll.** Clicking "Enroll" on a course with seats adds it to "My courses" and decreases its available seats by exactly one. |
| AC3 | **No duplicates.** After enrolling in a course, its button reads "Enrolled" and is disabled, and the course appears only once in "My courses". |
| AC4 | **Full courses.** A course with 0 seats shows "Full" and cannot be enrolled in. |
| AC5 | **Schedule clash.** Enrolling in a course that overlaps one already in "My courses" is rejected with a message that names the conflicting course. Seats and "My courses" do not change. |
| AC6 | **Drop.** Clicking "Drop" removes the course from "My courses" and gives its seat back. |
| AC7 | **Search.** Typing in the search box filters the catalog by course name, ignoring upper and lower case. Clearing it shows all courses again. |
| AC8 | **Persistence.** Enrollments and seat counts survive a page reload. |
| AC9 | **No runtime errors.** Using the app never throws an uncaught JavaScript error. |

Each criterion is worth one point. Profe proposes a grade out of 10, and your teacher reviews it before it is published.

## How your work is checked

Each criterion is a plain-English test that Kane CLI runs in a real Chrome browser against your app. Every result comes with evidence: screenshots of each step, console and network logs, and the reason a step failed. A test that could not run (for example, your URL was down) never counts against you. It goes to your teacher for review.

## Before you submit

Check your own app against the same criteria:

```bash
profe check assignments/course-enrollment --app ./my-app        # a folder with index.html
profe check assignments/course-enrollment --app https://you.github.io/tp3/
```

If you use a coding agent, point it at this file and at the `feedback.md` that `profe check` writes, and ask it to make every criterion pass.
