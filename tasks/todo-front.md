# Tasks: LectorBarras — Front

Spec: `SPEC-front.md` · Plan y decisiones: `tasks/plan-front.md`

**Regla común a todas las tareas:** al cerrar, `npm test`, `npm run lint`, `npm run build` y `npm run test:e2e` en verde (los 15 e2e existentes son la red de seguridad; no se debilitan ni se borran). Los textos que los e2e usan (`Stock actual: N`, `Código: …`, `No hay stock suficiente`, `Página X de Y`, `Siguiente`, nombres de botón, placeholders) no se cambian.

## Phase 1: Foundation

### Task 1: Tokens de diseño y base global (claro/oscuro) ✅

> Hecho. Contrastes calculados con un script (todos los pares ≥ AA; ver comentario en `globals.css`). Se agregó además `:focus-visible` global y `color-scheme: light dark`. Verificado en el build: `lang="es"`, `<title>LectorBarras`, tokens presentes en el CSS. El check manual en DevTools con esquema oscuro queda para el checkpoint de Foundation, cuando login/registro ya usen los tokens.

**Description:** Definir los tokens (color, superficie, borde, acento, semánticos éxito/advertencia/peligro, radios) en `globals.css` con valores para claro y oscuro, dejar de pisar Geist con Arial, y corregir el documento raíz: `lang="es"`, `<title>` y descripción reales, `viewport`/`themeColor` para claro y oscuro.

**Acceptance criteria:**
- [x] `globals.css` define los tokens en `@theme` y sus valores oscuros bajo `prefers-color-scheme: dark`; el `body` usa Geist (sin `font-family: Arial`)
- [x] `<html lang="es">`, `<title>` = "LectorBarras" y descripción correcta en todas las páginas
- [x] Pares texto/fondo de los tokens con contraste ≥ 4.5:1 en ambos esquemas (anotados en un comentario de `globals.css`)

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] E2E: `npm run test:e2e` (sin regresiones)
- [x] Manual check: emular esquema oscuro en DevTools y ver `/login` sin fondos claros residuales

**Dependencies:** None

**Files likely touched:**
- `src/app/globals.css`
- `src/app/layout.tsx`

**Estimated scope:** S

---

### Task 2: UI kit base + pantallas de login y registro ✅

> Hecho; 15 e2e y 38 unit en verde. Pendiente sólo el check manual (claro/oscuro, teclado, 360 px), que se hace en el checkpoint con el usuario. Extra: se agregaron los links cruzados Login ↔ Registro (antes no había forma de pasar de una a otra) y `autoComplete` en los campos.

**Description:** Crear `Button`, `Field` (label + input + error accesible) y `Alert`, y usarlos para rediseñar `/login` y `/register` (las pantallas más simples, ideales para validar el kit). Cada input gana `<label>` visible **conservando el placeholder actual**. Los formularios siguen siendo `<form action={formAction}>` con server actions.

**Acceptance criteria:**
- [x] `Field` asocia label↔input (`htmlFor`/`id`) y expone el error con `aria-invalid` + `aria-describedby` + `role="alert"`
- [x] `/login` y `/register` usan el kit, con estado "pendiente" en el botón y errores vía `Alert`; controles ≥ 44 px
- [x] Los formularios siguen enviándose por POST sin hidratar (el e2e "la contraseña no viaja en la URL…" pasa)

**Verification:**
- [x] Tests pass: `npm test`
- [x] E2E: `npm run test:e2e -- e2e/login.spec.ts`
- [ ] Manual check: `/login` y `/register` en 360 px, claro y oscuro, navegando sólo con teclado (foco visible)

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/ui/Button.tsx`, `Field.tsx`, `Alert.tsx`
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`

**Estimated scope:** M

---

## Checkpoint: Foundation
- [ ] `build`, `lint`, `test`, `test:e2e` en verde
- [ ] Login/registro revisados en claro y oscuro con el usuario antes de seguir

## Phase 2: Shell y home

### Task 3: Shell de navegación (grupo `(app)`) ✅

> Hecho; 15 e2e en verde. En el celular la navegación es una barra inferior fija (al alcance del pulgar); desde `sm` pasa al encabezado. Se quitó el `LogoutButton` y los links sueltos de `/scan` y `/products` (el shell los reemplaza). Pendiente sólo el check manual en el celular, en el checkpoint.

**Description:** Mover `scan` y `products` a un grupo de rutas `(app)` con un layout que muestra un encabezado fijo con navegación (Inicio / Escanear / Productos) y el botón de salir. Se quita el `LogoutButton` suelto de cada página. Las URLs no cambian. La navegación **no usa `<ul>/<li>`** (los e2e cuentan `listitem`).

**Acceptance criteria:**
- [x] `/scan` y `/products` viven en `src/app/(app)/` y responden en las mismas URLs
- [x] El encabezado marca la sección activa (`aria-current="page"`) y cada destino se alcanza con un toque, con objetivos ≥ 44 px, sin scroll horizontal a 360 px
- [x] `/login` y `/register` no muestran el shell; sin sesión, `/` sigue redirigiendo a `/login`

**Verification:**
- [x] E2E: `npm run test:e2e` completo (sobre todo `products.spec.ts` y `login.spec.ts`)
- [x] Build succeeds: `npm run build`
- [ ] Manual check: navegar Inicio → Escanear → Productos → Salir en el celular

**Dependencies:** Task 2

**Files likely touched:**
- `src/app/(app)/layout.tsx`
- `src/app/(app)/scan/page.tsx`, `src/app/(app)/products/page.tsx` (movidos con `git mv`)
- `src/components/LogoutButton.tsx`
- `src/components/ui/NavLink.tsx`

**Estimated scope:** M

---

### Task 4: Home real en `/` ✅

> Hecho; 16 e2e en verde (el smoke ahora prueba sin sesión → `/login` y con sesión → home con email y navegación). Se borraron los 5 SVG del template. `Card.tsx` **no se creó**: la home no lo necesita; se crea en la Task 5/6 cuando haya dos usos reales. Nota: una corrida de `next build` falló por tipos generados viejos en `.next/dev/types` (cache local ignorada por git, no afecta a Vercel); se borró esa carpeta.

**Description:** Reemplazar el template de create-next-app por la home: saludo con el email de la sesión y dos acciones grandes (Escanear / Buscar productos). Sin consultas nuevas a la base. Eliminar los assets del template que queden sin uso.

**Acceptance criteria:**
- [x] `/` no contiene rastro del template (logo de Next, textos, links de Vercel); muestra saludo y dos acciones ≥ 44 px que llevan a `/scan` y `/products`
- [x] Estado con sesión = home con shell; sin sesión = redirige a `/login` (comportamiento actual)
- [x] `e2e/smoke.spec.ts` verifica la home nueva

**Verification:**
- [x] E2E: `npm run test:e2e -- e2e/smoke.spec.ts e2e/login.spec.ts`
- [x] Build succeeds: `npm run build`
- [ ] Manual check: primera pantalla tras el login, en celular, claro y oscuro

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/(app)/page.tsx` (reemplaza `src/app/page.tsx`)
- `src/components/ui/Card.tsx`
- `e2e/smoke.spec.ts`
- `public/*.svg` (los del template, borrados)

**Estimated scope:** S

---

## Checkpoint: Shell
- [ ] Desde cualquier pantalla se llega a Escanear / Productos / Salir en un toque
- [ ] `/` ya no muestra el template; e2e en verde

## Phase 3: Pantallas de inventario

### Task 5: Rediseño de `/scan` (visor, resultado, alta) ✅

> Hecho; 16 e2e en verde. Visor con marco de encuadre y estado "Iniciando cámara…" (antes quedaba negro y mudo hasta que arrancaba). Se crearon `Card` y `Badge`, y `Alert` ganó `tone="warning"` para el aviso de lectura. Manual check en celular real pendiente (checkpoint).

**Description:** Restilizar la pantalla de escaneo: visor con marco y estado legible (iniciando / listo / error), tarjeta de resultado con el stock bien visible y un `Badge` "Sin stock" cuando es 0, botones `-1`/`+1` grandes, y `NewProductForm` con `Field`/`Button`. La lógica no cambia.

**Acceptance criteria:**
- [x] El ingreso manual, los mensajes de error de cámara y el aviso de lectura conservan su comportamiento y usan el kit (`Alert`, `Field`, `Button`)
- [x] El resultado muestra nombre, código y stock; con stock 0 aparece el `Badge` "Sin stock" (texto, no sólo color)
- [x] `-1`/`+1` ≥ 44 px y alcanzables con el pulgar; el "Escanear otro código" sigue funcionando
- [x] Los textos que usan los e2e no cambian

**Verification:**
- [x] E2E: `npm run test:e2e -- e2e/stock.spec.ts`
- [x] Build succeeds: `npm run build`
- [ ] Manual check: escanear con el celular real (producción, tras el push), claro y oscuro

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/(app)/scan/page.tsx`
- `src/components/BarcodeScanner.tsx`
- `src/components/NewProductForm.tsx`
- `src/components/ui/Badge.tsx`

**Estimated scope:** M

---

### Task 6: Rediseño de `/products` (listado, búsqueda, paginación) ✅

> Hecho; 16 e2e en verde. Manual check en celular real pendiente (checkpoint).

**Description:** Restilizar la búsqueda y el listado: campo de búsqueda con `Field`/`Button`, resultados como tarjetas tocables con nombre, código y stock (con `Badge` "Sin stock"), estados vacío y paginación clara. Se conserva la semántica de lista (`<ul>/<li>`) que usan los e2e.

**Acceptance criteria:**
- [x] Cada resultado es un link ≥ 44 px que abre `/scan?code=<barcode>` (sin cambios de URL)
- [x] Estado vacío diferencia "todavía no hay productos" de "sin coincidencias para «q»"
- [x] Paginación con "Página X de Y", "Anterior" y "Siguiente" alcanzables en 360 px

**Verification:**
- [x] E2E: `npm run test:e2e -- e2e/products.spec.ts`
- [x] Build succeeds: `npm run build`
- [ ] Manual check: buscar, paginar y abrir un producto desde el celular

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/(app)/products/page.tsx`
- `src/components/ui/Badge.tsx` (si T5 aún no lo creó)

**Estimated scope:** S

---

## Checkpoint: Pantallas
- [ ] Flujo escanear → ajustar → buscar en verde en e2e
- [ ] Revisión visual con el usuario en el celular (producción, tras el push)

## Phase 4: Extras

### Task 7: Feedback al escanear (vibración, sonido, silenciar) ✅

> **Actualizado:** la vibración se quitó después (pedido del usuario, ver `SPEC-scanner.md`); queda sólo el sonido al confirmar.

> Hecho; 42 unit y 16 e2e en verde. El feedback suena como máximo una vez cada 2 s por detección (zxing repite el mismo código en cada frame). El botón "Sonido: activado/silenciado" sólo aparece si la cámara arrancó, así que no hay e2e del toggle (headless no tiene cámara): se prueba a mano en el celular. La vibración no existe en iOS Safari (documentado en el spec).

**Description:** Módulo `feedback.ts` que, al detectar un código, dispara `navigator.vibrate` y un beep corto por Web Audio, ambos como mejora progresiva (si la API no existe, no pasa nada). Un control visible en el visor permite silenciar, y la preferencia persiste. El `AudioContext` se desbloquea con el primer toque del usuario en `/scan`.

**Acceptance criteria:**
- [x] Al detectar un código vibra y suena (salvo silenciado); sin `navigator.vibrate` o sin `AudioContext` el escaneo funciona igual
- [x] El control de silencio es un botón con nombre accesible y estado (`aria-pressed`); la preferencia persiste entre visitas (con `try/catch` por si el storage falla)
- [x] El feedback se dispara una sola vez por detección (no por frame)

**Verification:**
- [x] Tests pass: `npm test` (Vitest: respeta silencio, tolera APIs ausentes, persistencia con storage roto)
- [x] E2E: `npm run test:e2e -- e2e/stock.spec.ts`
- [ ] Manual check: en el celular, escanear con sonido, silenciar, recargar y confirmar que sigue silenciado

**Dependencies:** Task 5

**Files likely touched:**
- `src/lib/feedback.ts`, `src/lib/feedback.test.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** S

---

### Task 8: PWA instalable ✅

> Hecho; 17 e2e en verde (nuevo: el manifest y los 3 íconos responden 200 **sin sesión** y hay íconos 192, 512 y maskable). **Hallazgo:** el matcher de `src/proxy.ts` hubiera redirigido `/manifest.webmanifest` y `/icons/*` a `/login` (el navegador los pide sin cookies) y la app no habría sido instalable; se excluyeron del matcher. Íconos generados con Playwright desde `public/icons/icon.svg` (regenerable). Pendientes en celular real: instalar y abrir en standalone, y el chequeo de Chrome en DevTools → Application → Manifest.

**Description:** Agregar `app/manifest.ts` (nombre, `display: standalone`, colores, `start_url: /`) y los íconos 192, 512 y maskable, generados renderizando un SVG con Playwright (sin dependencias nuevas). Sin service worker. Agregar el `apple-touch-icon` para iOS.

**Acceptance criteria:**
- [x] `/manifest.webmanifest` es válido y Chrome (DevTools → Application → Manifest) no reporta errores de instalabilidad
- [x] Existen íconos 192 y 512 PNG y una variante maskable con zona segura
- [x] La app se instala desde el celular y abre en modo standalone

**Verification:**
- [x] Build succeeds: `npm run build`
- [ ] Manual check: DevTools → Application → Manifest sin advertencias
- [ ] Manual check: "Agregar a pantalla de inicio" en el celular real y abrir la app instalada

**Dependencies:** Task 1

**Files likely touched:**
- `src/app/manifest.ts`
- `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- `src/app/layout.tsx` (apple-touch-icon)

**Estimated scope:** M

---

## Phase 5: Verificación transversal

### Task 9: Proyecto Playwright mobile y e2e responsive ✅

> Hecho. El test encontró un defecto real: los links "Crear cuenta" / "Iniciar sesión" de login/registro medían 85×18 px; ahora son 44 px de alto. Cubre `/login`, `/register`, `/`, `/scan`, `/products` y la ficha de producto con "Sin stock". `npm run test:e2e` corre los dos proyectos: `chromium` (flujos) y `mobile` (sólo responsive).

**Description:** Agregar un proyecto `mobile` (360×740, touch) que sólo corre `responsive.spec.ts`, el cual recorre cada pantalla y verifica sin scroll horizontal y controles interactivos ≥ 44×44 px.

**Acceptance criteria:**
- [x] `playwright.config.ts` define el proyecto `mobile` con `testMatch: /responsive\.spec\.ts/`; los otros e2e siguen corriendo sólo en `chromium`
- [x] `responsive.spec.ts` cubre `/login`, `/register`, `/`, `/scan`, `/products`: `scrollWidth <= clientWidth` y tamaño mínimo de botones, links e inputs
- [x] Si una pantalla falla, se corrige en esta tarea (no se relaja el test)

**Verification:**
- [x] E2E: `npx playwright test --project=mobile`
- [x] E2E: `npm run test:e2e` completo (los 15 previos siguen igual)

**Dependencies:** Tasks 3, 4, 5, 6

**Files likely touched:**
- `playwright.config.ts`
- `e2e/responsive.spec.ts`
- correcciones puntuales en las pantallas, si hacen falta

**Estimated scope:** M

---

### Task 10: Accesibilidad AA con axe en claro y oscuro ✅

> Hecho; 0 violaciones AA en las 5 pantallas + alta + ficha con error, en claro y oscuro (23 e2e en verde en total). Se instaló `@axe-core/playwright` (aprobado en la spec). **El test se probó con una mutación:** subir el gris de `--muted` a `#b4b4bb` en `globals.css` hace fallar `color-contrast` (revertido). El test también verifica que el esquema emulado sea el pedido, para que "dark" no termine probando claro. Falta el check manual con Tab en `/scan`.

**Description:** Instalar `@axe-core/playwright` (dependencia ya aprobada en la spec) y escribir `a11y.spec.ts`: cada pantalla se analiza con etiquetas `wcag2a`, `wcag2aa`, `wcag21aa` en esquema claro y oscuro (`page.emulateMedia({ colorScheme })`). Corregir las violaciones que aparezcan.

**Acceptance criteria:**
- [x] `a11y.spec.ts` recorre `/login`, `/register`, `/`, `/scan`, `/products` en ambos esquemas con 0 violaciones
- [x] Todo input tiene `<label>` asociado; foco visible en todos los controles; ninguna información depende sólo del color
- [x] Las violaciones se corrigen en el código o en los tokens, no excluyendo reglas del análisis

**Verification:**
- [x] E2E: `npm run test:e2e -- e2e/a11y.spec.ts`
- [x] E2E: `npm run test:e2e` completo
- [ ] Manual check: recorrer `/scan` con teclado (Tab) y comprobar el foco visible

**Dependencies:** Tasks 3, 4, 5, 6, 9

**Files likely touched:**
- `package.json`, `package-lock.json`
- `e2e/a11y.spec.ts`
- `src/app/globals.css` y componentes con violaciones

**Estimated scope:** M

---

## Checkpoint: Completo
- [ ] Los 9 criterios de éxito de `SPEC-front.md` cumplidos
- [x] `npm run lint`, `npm test` (42), `npm run test:e2e` (23), `npm run build` en verde
- [ ] Probado en celular real: app instalada, escaneo con feedback, modo oscuro con poca luz
- [ ] Deploy de producción verificado
- [ ] Listo para review final
