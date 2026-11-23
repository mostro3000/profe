# Launch posts (at least two are required)

Tag TestMu AI on LinkedIn, tag @kane_cli on X, and use the event hashtag; check Slack for the official one (the site shows #KaneCLIHackDay).

## LinkedIn (English)

Students now hand in web apps written by AI coding agents. They look finished. Do they work?

For the #KaneCLIHackDay online hackathon by TestMu AI, I built **Profe**, a teaching assistant that actually runs students' apps. Each acceptance criterion is a plain-English Kane CLI test that runs in a real Chrome against every submission. Every point comes with evidence (each step, what the browser read, a public replay), and the teacher approves every grade before it is published.

My favorite moment: my first calibration said "all good". Kane's evidence pack showed that one of my own tests counted a missing favicon as a JavaScript error, which would have cost a student a point. A grader needs a grader.

Code: https://github.com/mostro3000/profe · Video: [link]

## LinkedIn (español)

Los alumnos ya entregan apps web escritas por agentes de IA. Parecen terminadas. ¿Funcionan?

Para el hackatón online de Kane CLI (TestMu AI) armé **Profe**: un ayudante de cátedra que corre de verdad las apps de los alumnos. Cada criterio de la consigna es un test en lenguaje natural que Kane ejecuta en un Chrome real contra cada entrega. Cada punto viene con evidencia (los pasos, lo que leyó el navegador y una repetición pública), y la nota la aprueba el docente.

Lo mejor: mi primera calibración dijo "todo bien", pero el evidence pack de Kane mostró que uno de mis propios tests contaba un favicon faltante como error de JavaScript. Le habría costado un punto a un alumno. Un corrector también necesita corrector.

Código: https://github.com/mostro3000/profe · Video: [link]

## X

Students hand in AI-built web apps that look finished. Profe runs them for real: each acceptance criterion is a plain-English @kane_cli test in a real Chrome, every point has evidence, and the teacher approves every grade. #KaneCLIHackDay

Kane even caught my grader's own flaky test before a student paid for it. https://github.com/mostro3000/profe

## Show HN

**Title:** Show HN: Profe, a grader that runs students' web apps in a real browser

I teach-adjacent at a university IT department. Students now submit apps built with coding agents; they look done, and a teacher can't click through 120 of them.

Profe takes an assignment's acceptance criteria as plain-English tests (Kane CLI), checks the tests themselves first: the reference solution must pass all of them, and apps with known bugs must fail exactly what they break. Then it grades every submission in a real Chrome, with one isolated browser per criterion and a sealed evidence pack per student. It proposes a grade that a teacher approves. `profe loop` hands the feedback to any coding agent and re-grades.

The most interesting part was calibration: my first run said "calibrated", and the evidence showed a console check counting a missing favicon as a JS error. https://github.com/mostro3000/profe
