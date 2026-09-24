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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
