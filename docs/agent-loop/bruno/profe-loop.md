# Profe loop: Bruno

**Assignment 3: Course Enrollment** · agent: `claude -p --model haiku --permission-mode acceptEdits` · ✅ every criterion passes

| Round | Grade | Passed | Failing | Commit |
|---|---|---|---|---|
| 0 | 7.8 | 7/9 | AC3, AC6 |  |
| 1 | 10 | 9/9 | – |  |

## Round 0: 7/9
- ❌ AC3: Checkpoint assertion failed: "the button for "Web Development" in the catalog reads "Enrolled" and is disabled" (step "Check the button and the list")
- ❌ AC6: Final verification failed: "The catalog shows 1 available seat for "Computer Networks"." (step "Check the seat came back")

**Agent round 1** (17 s, exit 0):

```text
Corregí los dos criterios fallidos en `index.html`. No ejecuté el grader ni pude comprobar la sintaxis del JavaScript (el chequeo con `node` fue rechazado por permisos), así que la verificación es solo por lectura del código.

- **AC3 · No duplicates:** el botón del catálogo ignoraba `state.enrolled`, así que mostraba "Enroll" y habilitado para un curso ya inscripto. Ahora el botón dice "Enrolled" y queda deshabilitado cuando el curso está en "My courses" (`courseItem`). Además, `enroll()` rechaza una segunda inscripción al mismo curso con un mensaje en la página.
- **AC6 · Drop:** `drop()` quitaba el curso de "My courses" pero no devolvía el cupo. Ahora incrementa `state.seats[id]` en uno, solo si el curso estaba inscripto, y guarda el estado.

Los datos iniciales, las etiquetas de la UI y el resto de la lógica quedaron sin cambios.
```

## Round 1: 9/9
