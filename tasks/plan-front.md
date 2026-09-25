# Implementation Plan: LectorBarras — Front

Spec: `SPEC-front.md`. Tareas: `tasks/todo-front.md`.

> Es un plan aparte de `tasks/plan.md` / `tasks/todo.md` (backend), que todavía tienen items abiertos (checkpoint "Completo" y los manual checks de webcam). No se pisan.

## Overview

Sistema visual común + shell de navegación + home real, aplicados a las cuatro pantallas existentes, con modo oscuro, feedback al escanear, PWA instalable y accesibilidad AA verificada en e2e. Se construye de abajo hacia arriba: tokens → componentes base (probados en las pantallas de auth, que son las más simples) → shell y home → pantallas de inventario → extras → verificación transversal.

## Dependency graph

```
T1 tokens + base global (globals.css, layout)
 ├── T2 UI kit + /login /register
 │     └── T3 shell (grupo (app), navegación) ── T4 home real
 │                 ├── T5 /scan ── T7 feedback al escanear
 │                 └── T6 /products
 └── T8 PWA (manifest + íconos)            ← independiente, sólo necesita T1
T9 proyecto Playwright mobile + responsive  ← necesita T3–T6
T10 axe claro/oscuro + correcciones         ← necesita T3–T6 (y T9 por config compartida)
```

## Architecture Decisions

- **Tokens en `@theme` de Tailwind 4** (`--color-surface`, `--color-border`, `--color-accent`, `--color-danger`, `--color-success`, `--color-warning`, …), con valores distintos en claro/oscuro bajo `prefers-color-scheme`. Los componentes usan sólo clases de token, así el modo oscuro sale de un único lugar y no hay `dark:` sueltos por toda la app.
- **Grupo de rutas `(app)`** para el shell autenticado y `(auth)` (ya existe) sin shell. Los grupos no cambian URLs, así que los e2e y links siguen igual.
- **Componentes propios en `src/components/ui/`** (Button, Field, Alert, Card, Badge), sin librería externa: son cinco piezas simples y no justifican una dependencia.
- **Los placeholders actuales se conservan** al agregar `<label>`. Los e2e localizan por `getByPlaceholder(...)`; un label visible con el placeholder intacto cumple AA y no rompe los tests.
- **Navegación sin `<ul>/<li>`.** `e2e/products.spec.ts` cuenta `getByRole("listitem")` para verificar la paginación; una lista en el encabezado contaminaría ese conteo.
- **Íconos PWA generados con Playwright** (renderizar un SVG y capturar 192/512 px). Evita agregar `sharp` o una herramienta de imágenes como dependencia.
- **Trabajo directo en `master`.** Decidido con el usuario: cada push despliega a producción y eso está bien. Se commitea y pushea por tarea, con `test`, `lint`, `build` y `test:e2e` en verde antes de cada push (es lo único que protege a producción).
- **Sin service worker.** Instalable = manifest + íconos + standalone; no hay requisito offline.

## Task List

### Phase 1: Foundation
- [ ] Task 1: Tokens de diseño y base global (claro/oscuro)
- [ ] Task 2: UI kit base + pantallas de login y registro

### Checkpoint: Foundation
- [ ] `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` en verde
- [ ] Login/registro se ven bien en claro y oscuro; revisión con el usuario

### Phase 2: Shell y home
- [ ] Task 3: Shell de navegación (grupo `(app)`)
- [ ] Task 4: Home real en `/`

### Checkpoint: Shell
- [ ] Desde cualquier pantalla se llega a Escanear / Productos / Salir en un toque
- [ ] `/` ya no muestra el template; e2e en verde

### Phase 3: Pantallas de inventario
- [ ] Task 5: Rediseño de `/scan` (visor, resultado, alta)
- [ ] Task 6: Rediseño de `/products` (listado, búsqueda, paginación)

### Checkpoint: Pantallas
- [ ] Flujo completo escanear → ajustar → buscar sigue en verde en e2e
- [ ] Revisión visual con el usuario en el celular (preview de la rama)

### Phase 4: Extras
- [ ] Task 7: Feedback al escanear (vibración, sonido, silenciar)
- [ ] Task 8: PWA instalable

### Phase 5: Verificación transversal
- [ ] Task 9: Proyecto Playwright mobile y e2e responsive
- [ ] Task 10: Accesibilidad AA con axe en claro y oscuro

### Checkpoint: Completo
- [ ] Los 9 criterios de éxito de `SPEC-front.md` cumplidos
- [ ] `lint`, `test`, `test:e2e`, `build` en verde
- [ ] Probado en celular real: instalada la app, escaneo con feedback, modo oscuro
- [ ] Deploy de producción verificado (curl + celular)

## Parallelization

- Tras T3: **T5 y T6 son independientes** (archivos distintos) y se pueden hacer en paralelo.
- **T8 (PWA)** sólo depende de T1: puede hacerse en cualquier momento después.
- Secuenciales: T1 → T2 → T3 → T4 (cada uno usa lo del anterior), T5 → T7 (ambos tocan `BarcodeScanner.tsx`), T9 → T10 (comparten `playwright.config.ts`).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cambios de markup rompen los 15 e2e (selectores por placeholder, `listitem`, nombres de botón por substring) | Alto | Conservar placeholders y textos exactos que usan los e2e; nav sin `<li>`; correr `test:e2e` al cierre de cada tarea, no sólo al final |
| Contraste insuficiente en modo oscuro o en estados (error, ámbar) | Medio | Tokens con ratio 4.5:1 verificado desde T1; axe en T10 en ambos esquemas |
| Sonido no suena en iOS (requiere gesto previo) | Bajo | Desbloquear el `AudioContext` con el primer toque en `/scan`; si no alcanza, iOS queda con vibración inexistente y feedback sólo visual (documentado en el spec) |
| Íconos PWA mal recortados (maskable) | Bajo | Zona segura del 80 % en el SVG; revisar en el instalador de Chrome y en el celular |
| Mover `scan`/`products` a `(app)` rompe imports relativos o el matcher del proxy | Medio | Mover con `git mv`, mantener `@/` en imports, verificar `/` → `/login` sin sesión en e2e |
| Suite e2e más lenta (build + 2 workers, ahora con proyecto mobile) | Bajo | El proyecto `mobile` sólo corre `responsive.spec.ts` (`testMatch`); no duplica los 15 e2e |
| Cada push a `master` despliega a producción (aceptado por el usuario) | Medio | Push sólo con la suite completa en verde; si un deploy sale roto se revierte el commit |

## Open Questions

- ~~¿Rama `front` o directo en `master`?~~ → directo en `master` (decidido).
- Las cinco preguntas abiertas de `SPEC-front.md` se resuelven con los defaults propuestos, que ya aprobaste: home con dos acciones y saludo, azul de acento, "sin stock" = 0 sin umbral, audio desbloqueado por toque, ícono simple generado.
