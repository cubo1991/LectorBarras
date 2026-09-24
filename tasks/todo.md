# Tasks: LectorBarras

Ver decisiones de arquitectura y riesgos en `tasks/plan.md`.

## Phase 1: Foundation

### Task 1: Scaffold del proyecto Next.js ✅

> Hecho. `npm run build`, `npm run lint` y `npm test` pasan. `npm run test:e2e` queda pendiente de `npx playwright install chromium`, que se está bajando en background por una descarga muy lenta (~29 KB/s) en este entorno — correrlo apenas termine.

**Description:** Crear el proyecto Next.js 15 (App Router) con TypeScript, Tailwind, ESLint, Vitest y Playwright configurados. Sin lógica de negocio todavía — solo que el proyecto compile, lintee y corra.

**Acceptance criteria:**
- [x] `npm run dev` levanta la app en local
- [x] `npm run build` y `npm run lint` pasan sin errores
- [x] Vitest corre un test dummy; Playwright — config y test dummy escritos, ejecución pendiente de `npx playwright install chromium` (falló por timeout de red)

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: `/`, `/login`, `/register` responden vía curl con el dev server real

**Dependencies:** None

**Files likely touched:**
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `vitest.config.ts`, `playwright.config.ts`

**Estimated scope:** M (scaffolding, varios archivos de config)

---

### Task 2: Esquema de base de datos y conexión a Supabase Postgres ✅

> Hecho. La DB real es Postgres vía la integración de Supabase en Vercel (no Neon como asumía el spec — se cambió el driver a `postgres.js`, ver commit "Cambiar driver de Neon a postgres.js"). Migración aplicada contra la DB real: las 3 tablas existen.

**Description:** Configurar Drizzle con `postgres.js`, definir el esquema inicial (`users`, `products`, `stock_movements`) con índices en `products.barcode` y `products.name`, y dejar el tooling de migraciones funcionando.

**Acceptance criteria:**
- [x] `src/lib/db/schema.ts` define `users`, `products`, `stock_movements` con sus relaciones (FK de `stock_movements` a `users` y `products`)
- [x] `products.barcode` tiene índice único; `products.name` tiene índice
- [x] `npm run db:generate` genera una migración válida; `npm run db:migrate` la aplica contra la DB de desarrollo

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: consulta directa confirmó las 3 tablas creadas en la DB real

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/db/schema.ts`
- `src/lib/db/client.ts`
- `drizzle.config.ts`
- `.env.example` (variables de conexión, sin valores reales)

**Estimated scope:** S

---

## Checkpoint: Foundation
- [x] `npm run build` pasa sin errores
- [x] `npm run db:migrate` corre contra la DB de desarrollo sin errores
- [x] Revisión con el usuario antes de seguir

## Phase 2: Autenticación

### Task 3: Registro y login con Auth.js ✅

> Hecho. Provider de credenciales, registro con Zod, páginas, `proxy.ts` protegiendo rutas (Next 16 renombró `middleware.ts` → `proxy.ts`). Probado de punta a punta contra la DB real (registro → hash → login → verificación de password correcta e incorrecta) y smoke test confirmó que `/` redirige a `/login` sin sesión. Verificación en el browser real (UI) queda pendiente — la extensión de Chrome no estaba conectada en esta sesión.

**Description:** Configurar Auth.js v5 con provider de credenciales (email + contraseña, hash con bcrypt), páginas de registro y login, y protección de rutas para que el resto de la app requiera sesión.

**Acceptance criteria:**
- [x] Un usuario nuevo puede registrarse desde `/register` (contraseña se guarda hasheada, nunca en texto plano)
- [x] Un usuario registrado puede loguearse en `/login` y cerrar sesión
- [x] Rutas fuera de `/login` y `/register` redirigen a `/login` si no hay sesión

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: probado contra la DB real (script directo, no UI) — registrarse, verificar password correcta e incorrecta

**Dependencies:** Task 2

**Files likely touched:**
- `src/lib/auth.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/proxy.ts` (antes `src/middleware.ts`)
- `src/lib/actions/auth.ts`

**Estimated scope:** M

---

## Checkpoint: Auth
- [x] Un usuario nuevo puede registrarse, cerrar sesión y volver a loguearse (verificado contra la DB real; UI pendiente de probar en browser)

## Phase 3: Flujo de inventario (escaneo → producto → stock)

### Task 4: Componente de escaneo por cámara

**Description:** Componente cliente que activa la cámara, decodifica códigos de barras con `@zxing/browser` (EAN-13, UPC-A) y expone el código detectado. Incluye fallback de ingreso manual del código para cuando la cámara falla o el código está dañado.

**Acceptance criteria:**
- [ ] El componente pide permiso de cámara y muestra el video en vivo
- [ ] Al detectar un código válido, dispara un callback con el valor decodificado
- [ ] Si el usuario no da permiso de cámara o falla, hay un input manual como alternativa

**Verification:**
- [ ] Tests pass: `npm test` (lógica de parseo/validación del código, sin depender de cámara real)
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: escanear un código de barras real desde el celular y desde una notebook con webcam

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/scanner.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

### Task 5: Búsqueda de producto por código escaneado

**Description:** Server action que recibe un código de barras y devuelve el producto con su stock actual, o `null` si no existe. Página que integra el componente de escaneo (Task 4) y muestra el resultado.

**Acceptance criteria:**
- [ ] Al escanear un código existente, se muestra nombre del producto y stock actual
- [ ] Al escanear un código inexistente, se ofrece el flujo de alta (Task 6)

**Verification:**
- [ ] Tests pass: `npm test` (server action con casos: código existe / no existe)
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: escanear un producto ya cargado y uno que no existe

**Dependencies:** Task 2, Task 4

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/app/scan/page.tsx`

**Estimated scope:** S

---

### Task 6: Alta de producto nuevo

**Description:** Formulario y server action para dar de alta un producto (código de barras, nombre, stock inicial) cuando el escaneo no encuentra coincidencia.

**Acceptance criteria:**
- [ ] El formulario valida con Zod (código no vacío y único, nombre no vacío, stock inicial ≥ 0)
- [ ] Al guardar, el producto queda disponible para búsquedas y escaneos futuros
- [ ] Intentar dar de alta un código ya existente muestra un error claro, no un crash

**Verification:**
- [ ] Tests pass: `npm test` (validación Zod, caso de código duplicado)
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: dar de alta un producto nuevo y volver a escanearlo

**Dependencies:** Task 2, Task 5

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/components/NewProductForm.tsx`

**Estimated scope:** S

---

### Task 7: Ajuste de stock (sumar/restar + registro de movimiento)

**Description:** Server action para sumar o restar unidades de stock de un producto. Cada ajuste inserta una fila en `stock_movements` con usuario, timestamp y delta.

**Acceptance criteria:**
- [ ] Sumar/restar actualiza `products.stock` y no permite que quede negativo
- [ ] Cada ajuste crea un registro en `stock_movements` con el usuario logueado, timestamp y delta
- [ ] La UI de producto (Task 5) muestra el stock actualizado sin recargar la página

**Verification:**
- [ ] Tests pass: `npm test` (ajuste positivo, negativo, intento de dejar stock negativo)
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: ajustar stock de un producto y verificar en `db:studio` que quedó el movimiento

**Dependencies:** Task 3, Task 5

**Files likely touched:**
- `src/lib/actions/stock.ts`
- `src/app/scan/page.tsx` (o componente de detalle de producto)

**Estimated scope:** S

---

## Checkpoint: Flujo core
- [ ] Flujo completo funciona a mano: loguearse → escanear → (producto existe: ver stock, ajustar) o (no existe: dar de alta) → el movimiento queda registrado
- [ ] Revisión con el usuario antes de seguir

## Phase 4: Búsqueda y pulido

### Task 8: Búsqueda de productos por nombre/código sin escanear

**Description:** Página de listado/búsqueda de productos (por nombre o código), paginada, para no depender siempre de la cámara.

**Acceptance criteria:**
- [ ] Buscar por nombre parcial o código exacto devuelve resultados relevantes
- [ ] El listado pagina (no trae los 5000 productos de una)
- [ ] Cada resultado permite ir al detalle/ajuste de stock (Task 7)

**Verification:**
- [ ] Tests pass: `npm test` (búsqueda por nombre parcial, por código, sin resultados)
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: buscar con un catálogo de prueba con >100 productos

**Dependencies:** Task 2, Task 7

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/app/products/page.tsx`

**Estimated scope:** S

---

### Task 9: Manejo de permisos de cámara y verificación mobile

**Description:** Pulir el manejo de errores de permiso de cámara (denegado, no disponible, HTTPS requerido) y verificar el flujo completo en un navegador mobile real.

**Acceptance criteria:**
- [ ] Si se deniega el permiso de cámara, se muestra un mensaje claro y el input manual sigue funcionando
- [ ] El flujo de escaneo se probó en un celular real (Chrome Android o Safari iOS)
- [ ] La UI es usable en pantallas chicas (sin scroll horizontal, botones alcanzables)

**Verification:**
- [ ] Manual check: probar en un celular real con la app desplegada (Vercel preview) o en HTTPS local
- [ ] Manual check: denegar el permiso de cámara a propósito y confirmar que no rompe la página

**Dependencies:** Task 4, Task 8

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- estilos responsive en las páginas de `src/app/`

**Estimated scope:** S

---

### Task 10: Tests e2e de los flujos críticos

**Description:** Tests Playwright de los flujos que rompen el inventario si fallan: login, escanear→ajustar stock (con cámara mockeada), alta de producto, búsqueda.

**Acceptance criteria:**
- [ ] `npm run test:e2e` corre y pasa en CI/local sin cámara real (mock de `getUserMedia` o input manual)
- [ ] Cubre: login, ajuste de stock end-to-end, alta de producto, búsqueda

**Verification:**
- [ ] Tests pass: `npm run test:e2e`

**Dependencies:** Task 3, Task 6, Task 7, Task 8

**Files likely touched:**
- `e2e/login.spec.ts`
- `e2e/stock.spec.ts`
- `e2e/products.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Completo
- [ ] Todos los criterios de éxito del SPEC.md están cumplidos
- [ ] `npm run lint`, `npm test` y `npm run test:e2e` pasan
- [ ] Listo para review final
