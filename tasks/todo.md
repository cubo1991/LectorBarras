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
>
> **Corregido durante Task 10 — pérdida silenciosa de datos.** `client.ts` construía el cliente con `postgres(url)` a secas. `DATABASE_URL` apunta al pooler de Supabase en modo transacción (puerto 6543), donde los prepared statements de postgres-js —activados por default— no sobreviven al pooling. Efecto medido con 24 transacciones concurrentes (insert de producto + movimiento): **12 commitearon y 12 se perdieron sin lanzar ningún error**; la app recibía `ok: true` con la fila que devolvía el `RETURNING` y la fila no existía. Con `prepare: false`: 24/24. Es el riesgo "driver de conexión mal elegido" que `plan.md` marcaba como Alto, materializado como corrupción silenciosa en vez de timeouts. Se descubrió porque un e2e concurrente falló con "El producto no existe" justo después de crearlo.
>
> Secuencialmente **no se reproduce** (6/6 con y sin `prepare`), así que los manual checks de Tasks 5–7, que se hicieron de a una operación, no podían detectarlo.

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

> Hecho. Provider de credenciales, registro con Zod, páginas, `proxy.ts` protegiendo rutas (Next 16 renombró `middleware.ts` → `proxy.ts`). Probado de punta a punta contra la DB real (registro → hash → login → verificación de password correcta e incorrecta) y smoke test confirmó que `/` redirige a `/login` sin sesión. Registro y login **sí** quedaron verificados en browser real (por el usuario y por los e2e de Task 10).
>
> **DOS DEFECTOS ENCONTRADOS Y CORREGIDOS durante Task 10:**
>
> 1. **No existía UI de logout.** El criterio "puede loguearse en `/login` y cerrar sesión" estaba marcado como cumplido, pero `signOut` se exportaba en `src/lib/auth.ts` y **no se usaba en ningún componente**: no había botón ni ruta. Se colgó porque ese criterio se verificó con un script directo contra la DB, no por UI. Corregido: `logoutAction` + `src/components/LogoutButton.tsx`, presente en `/scan` y `/products`. Cubierto por el e2e "cierra sesión desde la app y vuelve a entrar".
>
> 2. **La contraseña podía terminar en la URL.** `login/page.tsx` y `register/page.tsx` eran client components cuyo `<form>` dependía del `onSubmit` de React. Si el formulario se enviaba **antes de que la página hidratara** (probable en mobile o conexión lenta), el browser hacía el submit nativo: un **GET** a `/login?email=...&password=...`, dejando la contraseña en la barra de direcciones, el historial y los logs del server. Se detectó de casualidad cuando un e2e falló y la URL del snapshot mostraba la contraseña en claro. Corregido: los dos forms pasaron a server actions (`loginAction`/`registerAction` con `useActionState`), que se envían por POST y funcionan sin JS. Cubierto por el e2e "la contraseña no viaja en la URL si el form se envía sin hidratar", que bloquea los bundles JS para reproducir la ventana sin hidratar.

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

### Task 4: Componente de escaneo por cámara ⚠️ parcial

> Código completo (BarcodeScanner + fallback manual). Falta el manual check con cámara real (celular/webcam) — necesita browser real, la extensión de Chrome no estaba conectada en esta sesión.

**Description:** Componente cliente que activa la cámara, decodifica códigos de barras con `@zxing/browser` (EAN-13, UPC-A) y expone el código detectado. Incluye fallback de ingreso manual del código para cuando la cámara falla o el código está dañado.

**Acceptance criteria:**
- [x] El componente pide permiso de cámara y muestra el video en vivo (código revisado; sin verificar con cámara real)
- [x] Al detectar un código válido, dispara un callback con el valor decodificado
- [x] Si el usuario no da permiso de cámara o falla, hay un input manual como alternativa

**Verification:**
- [x] Tests pass: `npm test` (lógica de parseo/validación del código, sin depender de cámara real)
- [x] Build succeeds: `npm run build`
- [ ] Manual check: escanear un código de barras real desde el celular y desde una notebook con webcam — **pendiente, necesita browser real**

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/scanner.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

### Task 5: Búsqueda de producto por código escaneado ✅

> Hecho y probado contra la DB real (ambos caminos: encontrado / no encontrado).

**Description:** Server action que recibe un código de barras y devuelve el producto con su stock actual, o `null` si no existe. Página que integra el componente de escaneo (Task 4) y muestra el resultado.

**Acceptance criteria:**
- [x] Al escanear un código existente, se muestra nombre del producto y stock actual
- [x] Al escanear un código inexistente, se ofrece el flujo de alta (Task 6)

**Verification:**
- [x] Tests pass: `npm test` (lookup es un passthrough trivial a la DB, sin ramas propias que testear en aislado)
- [x] Build succeeds: `npm run build`
- [x] Manual check: verificado contra la DB real con un producto insertado y un código inexistente

**Dependencies:** Task 2, Task 4

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/app/scan/page.tsx`

**Estimated scope:** S

---

### Task 6: Alta de producto nuevo ✅

> Hecho. Validación Zod probada en aislado; alta + bloqueo de duplicado probados contra la DB real.
>
> Corregido después del checkpoint: el stock inicial no generaba un registro en `stock_movements`, así que el historial no podía explicar el stock actual — violaba el Boundary del SPEC "todo cambio de stock queda registrado (quién, cuándo, cuánto)". Ahora `createProduct` corre en una transacción y, si el stock inicial es > 0, inserta el movimiento con el usuario de la sesión. El chequeo de duplicado se movió dentro de la misma transacción. La validación Zod sigue corriendo **antes** de `auth()` para que un input inválido no consulte sesión ni DB (y para que los tests unitarios no necesiten next-auth).

**Description:** Formulario y server action para dar de alta un producto (código de barras, nombre, stock inicial) cuando el escaneo no encuentra coincidencia.

**Acceptance criteria:**
- [x] El formulario valida con Zod (código no vacío y único, nombre no vacío, stock inicial ≥ 0)
- [x] Al guardar, el producto queda disponible para búsquedas y escaneos futuros
- [x] Intentar dar de alta un código ya existente muestra un error claro, no un crash

**Verification:**
- [x] Tests pass: `npm test` (validación Zod: código no numérico, nombre vacío, stock negativo)
- [x] Build succeeds: `npm run build`
- [x] Manual check: verificado contra la DB real — alta exitosa y el índice único bloquea el duplicado

**Dependencies:** Task 2, Task 5

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/components/NewProductForm.tsx`

**Estimated scope:** S

---

### Task 7: Ajuste de stock (sumar/restar + registro de movimiento) ✅

> Hecho. `adjustStock()` no se pudo unit-testear (auth() de NextAuth no resuelve en Vitest fuera de una request real) — verificado en cambio con un script directo contra la DB real replicando la misma lógica transaccional.

**Description:** Server action para sumar o restar unidades de stock de un producto. Cada ajuste inserta una fila en `stock_movements` con usuario, timestamp y delta.

**Acceptance criteria:**
- [x] Sumar/restar actualiza `products.stock` y no permite que quede negativo
- [x] Cada ajuste crea un registro en `stock_movements` con el usuario logueado, timestamp y delta
- [x] La UI de producto (Task 5) muestra el stock actualizado sin recargar la página

**Verification:**
- [x] Tests pass: `npm test` (no aplica test unitario directo por la dependencia de `auth()`, ver nota arriba)
- [x] Build succeeds: `npm run build`
- [x] Manual check: verificado contra la DB real — suma, resta, bloqueo de stock negativo, y conteo correcto de movimientos registrados

**Dependencies:** Task 3, Task 5

**Files likely touched:**
- `src/lib/actions/stock.ts`
- `src/app/scan/page.tsx` (o componente de detalle de producto)

**Estimated scope:** S

---

## Checkpoint: Flujo core
- [x] Flujo completo funciona a mano: loguearse → escanear → (producto existe: ver stock, ajustar) o (no existe: dar de alta) → el movimiento queda registrado (verificado con scripts directos contra la DB real; falta la vuelta completa en un browser real con cámara — ver Task 4 y Task 9)
- [x] Revisión con el usuario antes de seguir — el usuario recorrió el flujo en el browser (registro, login, alta, ajuste) y reportó dos defectos, ya corregidos:
  - `NewProductForm` tenía `defaultValue={0}` en el stock inicial: el `0` quedaba pegado adelante de lo tipeado. Ahora arranca vacío.
  - `/scan` no tenía forma de volver al escáner: el estado `result` nunca se limpiaba. Se agregó "Escanear otro código" y se oculta el scanner mientras hay un resultado.
  - Defecto adicional encontrado al revisar los datos (violaba el Boundary "todo cambio de stock queda registrado"): el stock inicial del alta no generaba movimiento. Corregido en Task 6.

## Phase 4: Búsqueda y pulido

### Task 8: Búsqueda de productos por nombre/código sin escanear ✅

> Hecho. `searchProducts` busca por código exacto (`=`) u OR nombre parcial (`ilike %q%`), ordena por nombre y pagina de 20. Verificado contra la DB real con un catálogo de 152 productos.
>
> Nota sobre el criterio de 5000 productos: la búsqueda por código usa `Index Scan` sobre `products_barcode_idx`, pero el `ilike '%q%'` del nombre hace `Seq Scan` — un índice btree no sirve con wildcard adelante, al contrario de lo que asumía `plan.md`. Con 152 filas el `explain analyze` da 0.28ms y con 5000 seguiría en pocos ms, así que el criterio se cumple; si el catálogo creciera mucho más, la solución es un índice GIN con `pg_trgm` (requiere migración → Boundary "ask first").
>
> `PRODUCTS_PAGE_SIZE` vive en `src/lib/pagination.ts` y no en el action: un módulo `"use server"` sólo puede exportar funciones async, exportar la constante ahí rompía el build.

**Description:** Página de listado/búsqueda de productos (por nombre o código), paginada, para no depender siempre de la cámara.

**Acceptance criteria:**
- [x] Buscar por nombre parcial o código exacto devuelve resultados relevantes
- [x] El listado pagina (no trae los 5000 productos de una) — 20 por página, `limit`/`offset` en la query
- [x] Cada resultado permite ir al detalle/ajuste de stock (Task 7) — el link va a `/scan?code=<barcode>`, que abre la ficha sin pasar por la cámara

**Verification:**
- [x] Tests pass: `npm test` (nombre parcial, código exacto, sin resultados, límite/offset de paginación, `page` como string)
- [x] Build succeeds: `npm run build`
- [x] Manual check: verificado contra la DB real con 152 productos — 'lech' → 11, 'queso' → 10, código exacto → 1, inexistente → 0, sin query → 8 páginas (20 + 12 en la última)

**Dependencies:** Task 2, Task 7

**Files likely touched:**
- `src/lib/actions/products.ts`
- `src/app/products/page.tsx`

**Estimated scope:** S

---

### Task 9: Manejo de permisos de cámara y verificación mobile ⚠️ parcial

> Código hecho. Faltan los dos manual checks, que necesitan un browser real y un celular.
>
> `src/lib/scanner.ts` ahora traduce el error de `getUserMedia` a un mensaje accionable según el caso: permiso denegado (`NotAllowedError`/`SecurityError`), sin cámara en el dispositivo (`NotFoundError`/`OverconstrainedError`), cámara ocupada por otra app (`NotReadableError`), y HTTP sin contexto seguro (`getUserMedia` no existe). Todos ofrecen el ingreso manual.
>
> **Bug corregido en `BarcodeScanner`:** cualquier excepción de decodificación que no fuera `NotFoundException` seteaba el error de cámara, y como el `<video>` se renderizaba condicionalmente, eso lo **desmontaba y dejaba al reader sin destino** — un solo frame con checksum o formato malo (algo normal apuntando a un código dañado o con poca luz) apagaba la cámara para siempre. Ahora `ChecksumException` y `FormatException` también se tratan como transitorias, y un error de lectura no fatal muestra un aviso sin desmontar el video.
>
> Nota: el chequeo de contexto seguro se lanza como excepción (`insecureContextError`) en vez de setear estado en el effect, para no violar `react-hooks/set-state-in-effect` y para no romper la hidratación (en el server `navigator` no existe, así que un inicializador de `useState` daría mismatch).

**Description:** Pulir el manejo de errores de permiso de cámara (denegado, no disponible, HTTPS requerido) y verificar el flujo completo en un navegador mobile real.

**Acceptance criteria:**
- [x] Si se deniega el permiso de cámara, se muestra un mensaje claro y el input manual sigue funcionando
- [ ] El flujo de escaneo se probó en un celular real (Chrome Android o Safari iOS) — **pendiente, necesita celular + HTTPS**
- [x] La UI es usable en pantallas chicas (sin scroll horizontal, botones alcanzables) — padding `p-4 sm:p-8`, botones con `min-h-11` (mínimo táctil), `+1`/`-1` a ancho completo, form del código con `flex-wrap` y `min-w-0` para que no desborde

**Verification:**
- [ ] Manual check: probar en un celular real con la app desplegada (Vercel preview) o en HTTPS local — **pendiente**
- [ ] Manual check: denegar el permiso de cámara a propósito y confirmar que no rompe la página — **pendiente** (cubierto por unit tests sobre el mapeo de errores, pero no probado en un browser real)

**Dependencies:** Task 4, Task 8

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- estilos responsive en las páginas de `src/app/`

**Estimated scope:** S

---

### Task 10: Tests e2e de los flujos críticos ✅

> Hecho: 14 tests en verde. Usan el ingreso manual del código (headless no tiene cámara), que es el fallback que el SPEC pide igual.
>
> Tres cosas de infraestructura que hubo que resolver, todas del entorno y no del código de la app:
> 1. **`webServer` pasó de `npm run dev` a `npm run build && npm run start`.** Con el dev server cada ruta se compila en el primer request (decenas de segundos en este disco) y el evento `load` no llegaba: 12 de 14 tests morían por timeout navegando. Además dejaba ventanas donde el click caía antes de que React hidratara y el form hacía un **GET nativo** — con la contraseña en la query string.
> 2. **`workers: 2`.** Con los workers por default (mitad de los cores) cada uno levanta su Chromium y todos pelean por el mismo server; con ~3GB libres se ahogaban.
> 3. **`AUTH_TRUST_HOST=true` en el env del `webServer`.** En producción Auth.js exige confiar el host explícitamente (en Vercel lo hace solo); sin eso `next start` en localhost responde `UntrustedHost` y todo login termina en `/api/auth/error`. Se puso en la config de test y **no** en `auth.ts`, para no bajarle esa verificación a la app.
>
> Los e2e corren contra la DB de desarrollo y dejan datos etiquetados. Para limpiarlos:
> ```sql
> delete from stock_movements where product_id in (select id from products where name like '[E2E]%');
> delete from products where name like '[E2E]%';
> delete from users where email like 'e2e-%@example.test';
> ```
>
> Ruido esperado en la salida: `[auth][error] CredentialsSignin`, que es el login rechazado a propósito por el test de contraseña incorrecta.

**Description:** Tests Playwright de los flujos que rompen el inventario si fallan: login, escanear→ajustar stock (con cámara mockeada), alta de producto, búsqueda.

**Acceptance criteria:**
- [x] `npm run test:e2e` corre y pasa en CI/local sin cámara real (usa el ingreso manual del código)
- [x] Cubre: login, ajuste de stock end-to-end, alta de producto, búsqueda

**Verification:**
- [x] Tests pass: `npm run test:e2e` — 14/14

**Dependencies:** Task 3, Task 6, Task 7, Task 8

**Files likely touched:**
- `e2e/login.spec.ts`
- `e2e/stock.spec.ts`
- `e2e/products.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Completo
- [ ] Todos los criterios de éxito del SPEC.md están cumplidos — faltan los dos que dependen de la cámara/mobile (ver abajo); el de 5000 productos se verificó por plan de query con 152 filas, no con un catálogo de 5000 real
- [x] `npm run lint`, `npm test` y `npm run test:e2e` pasan — 29 unit, 15 e2e, lint sin warnings, build OK
- [ ] Listo para review final

### Deploy hecho
Producción en https://lectorbarras.vercel.app (proyecto `lectorbarras`, repo conectado: cada push a `master` redespliega). Verificado con curl: `/` redirige a `/login` (el proxy funciona en Vercel) y `/login` responde 200. Variables cargadas en Production: `DATABASE_URL`, `AUTH_SECRET`. Usa la misma DB que desarrollo.

### Lo único que falta del plan (todo requiere un browser/celular real)
- Task 4: escanear un código de barras real con cámara (celular y webcam de notebook)
- Task 9: probar el flujo en un celular real — necesita HTTPS, o sea un deploy (Vercel preview) o un túnel HTTPS local
- Task 9: denegar el permiso de cámara a propósito y confirmar que la página no rompe

### ~~Fuera del plan, pero bloquea el deploy~~ — descartado, no aplica
Se sospechaba que `src/proxy.ts` (que importa `auth` → `postgres` + `bcryptjs`) fallaría en Vercel por correr en Edge. **Falso en Next 16:** `proxy` corre siempre en runtime Node.js y no es configurable (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:255`, `.../upgrading/version-16.md:616`). Sólo el `middleware.ts` viejo podía ser Edge. No hace falta partir la config de Auth.js; el deploy no está bloqueado por esto.
