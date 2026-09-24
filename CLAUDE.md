# LectorBarras

Este proyecto se trabaja con **Spec-Driven Development**: no se escribe código sin spec aprobada primero.

## Flujo

1. **Specify** — spec en `SPEC.md` (o `SPEC-<módulo>.md` si el proyecto se parte en módulos independientes). Cubre: objetivo, stack, comandos, estructura, estilo, testing, boundaries (siempre/preguntar/nunca), criterios de éxito.
2. **Plan** — `tasks/plan.md`: componentes, orden de implementación, riesgos, qué es paralelizable.
3. **Tasks** — `tasks/todo.md`: tareas chicas, cada una con criterio de aceptación y forma de verificar.
4. **Implement** — una tarea a la vez, incremental, con tests.

Cada fase la revisa y aprueba el usuario antes de pasar a la siguiente.

Skills instaladas para este flujo (`~/.agents/skills/`): `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `context-engineering`, `api-and-interface-design`.

Sin spec aprobada todavía. Antes de escribir código, invocar la skill `spec-driven-development`.
