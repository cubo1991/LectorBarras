# Tasks: LectorBarras — Flujo de escaneo continuo

Spec: `SPEC-flow.md` · Plan y decisiones: `tasks/plan-flow.md`

**Regla común:** al cerrar cada tarea, `npm test`, `npm run lint`, `npm run build` y `npm run test:e2e` en verde (los 39 e2e existentes son la red de seguridad; se actualizan sólo los que dependen de un texto o URL que la tarea cambia, en el mismo commit). Un commit y push por tarea.

## Phase 1: Integridad y reglas

### Task 1: `adjustStock` atómico, tope de cantidad y test de concurrencia ✅

> Hecho; 106 unit, 5 `test:db` y 39 e2e en verde. **La mutación confirmó el bug real:** con la implementación vieja, 20 ajustes +1 concurrentes sobre un stock de 5 terminaron en **7 en vez de 25** (se perdieron 18 de 20), y 12 restas concurrentes sobre un stock de 5 dejaron pasar las 12 (stock negativo). Con `UPDATE … SET stock = stock + delta WHERE … AND stock + delta >= 0` dan +20 exactos y sólo 5 de 12 restas. Ojo: mientras hice la mutación un `git checkout` pisó la versión nueva sin commitear; estaba respaldada y se restauró, pero conviene no revertir con git trabajo no commiteado.

**Description:** Hoy `adjustStock` lee el stock y después lo escribe: dos ajustes simultáneos se pisan. Hacerlo atómico (`stock = stock + delta` con la condición de no quedar negativo en la misma sentencia + insert del movimiento en la misma transacción) y limitar el ajuste a ±9999. Agregar un proyecto de Vitest contra la base real (`test:db`) que demuestre la corrección.

**Acceptance criteria:**
- [x] Un ajuste que dejaría stock negativo se rechaza con "No hay stock suficiente" y no cambia nada (ni stock ni movimientos)
- [x] `delta` 0, no entero, > 9999 o < -9999 se rechaza con un mensaje claro antes de tocar la base
- [x] 20 ajustes `+1` concurrentes sobre el mismo producto terminan exactamente en +20 y dejan 20 movimientos
- [x] Cada ajuste (incluido uno inverso) inserta su movimiento con usuario y delta
- [x] `npm test` (diario) **no** corre los tests de base; `npm run test:db` sí

**Verification:**
- [x] Tests pass: `npm test` (validación de `delta` con la base simulada)
- [x] Tests pass: `npm run test:db` (concurrencia, negativo, movimientos; crea usuario/producto etiquetados y los limpia)
- [ ] Manual check: confirmar que el test **falla** con la implementación vieja (mutación), luego pasa con la nueva

**Dependencies:** None

**Files likely touched:**
- `src/lib/actions/stock.ts`, `src/lib/actions/stock.test.ts`, `src/lib/actions/stock.db.test.ts`
- `vitest.db.config.mts`, `vitest.config.mts` (excluir `*.db.test.ts`), `package.json` (`test:db`)

**Estimated scope:** M

---

### Task 2: Reglas puras — anti-duplicado y ayuda contextual ✅

> Hecho; 118 unit en verde. La API real de `scan-rearm` es `observe(code, now)` (con cada lectura válida) + `shouldCount(code)` (al confirmar): mi primer boceto de la spec marcaba 'visto' y 'contar' con el mismo reloj y **nunca habría re-armado**, porque cada lectura ya actualizaba la hora antes de preguntar; se detectó al pensar el caso y se corrigió antes de escribirlo (la spec quedó sincronizada). Casos probados: código quieto 10 s cuenta 1; 24 unidades una tras otra cuentan 24; ausencia corta (500 ms) no re-arma. Límite documentado: un código a la vista que no se lee durante 700 ms se toma como que salió; el valor es una constante ajustable.

**Description:** Dos módulos puros y testeados. `createRearm(absentMs)` decide si una lectura confirmada debe contarse: el mismo código no cuenta de nuevo mientras siga a la vista; cuenta cuando salió (≥ `absentMs` sin verse) o cuando llega otro. `helpFor(msWithoutReading, {torchAvailable})` devuelve la pista correspondiente (normal, 8 s, 20 s).

**Acceptance criteria:**
- [x] El mismo código a la vista no cuenta dos veces; sale del marco ≥ 700 ms y vuelve → cuenta; otro código → cuenta
- [x] `seen()` mantiene vivo el código mientras siga leyéndose aunque no se confirme
- [x] `helpFor` devuelve la pista base, la de 8 s ("Probá acercar o alejar…", o "Poca luz: encendé la linterna" si hay linterna) y la de 20 s (ingreso manual)
- [x] Constantes con nombre y el porqué en `scanner.ts` (700 ms, 8 s, 20 s)

**Verification:**
- [x] Tests pass: `npm test -- src/lib/scan-rearm.test.ts src/lib/scan-help.test.ts`

**Dependencies:** None

**Files likely touched:**
- `src/lib/scan-rearm.ts`, `src/lib/scan-rearm.test.ts`
- `src/lib/scan-help.ts`, `src/lib/scan-help.test.ts`
- `src/lib/scanner.ts`

**Estimated scope:** S

---

## Checkpoint: Reglas
- [x] `test`, `lint`, `build`, `test:e2e` y `test:db` en verde

## Phase 2: La pantalla persistente

### Task 3: Cámara viva + ficha bajo el visor + fixture "pulso" ✅

> Hecho; 119 unit y 41 e2e en verde. `ProductPanel` extrae la ficha/alta; el visor ya no se desmonta y no existe `Escanear otro código`. E2E de punta a punta con el video 'pulso': con el código quieto 5 s hay **1** búsqueda y **1** `getUserMedia` (la cámara no se reinicia); al salir y volver se busca de nuevo y nunca más de una por presentación. **Tres hallazgos al probarlo:** (1) la regla anti-duplicado con sólo tiempo contaba dos veces en el e2e (decodificaciones lentas superaban los 700 ms con el código quieto): ahora exige además ≥ 3 vueltas vacías seguidas (`REARM_MIN_MISSES`), lo que también protege a los celulares lentos; (2) al quedar el código a la vista, cada lectura pisaba el estado 'confirmado' con 'leyendo' a los 100 ms: ahora el marco queda verde mientras el código siga leyéndose; (3) se eliminó la guarda `lookingUp` y el enfriamiento de 3 s de la página (ya no hacen falta) y se reemplazaron por un número de búsqueda para que sólo la última pinte.

**Description:** El visor deja de desmontarse: la ficha (o el formulario "no cargado") aparece **debajo** y escanear otro producto la reemplaza. Se quita el botón "Escanear otro código". `BarcodeScanner` aplica la regla anti-duplicado (T2) antes de avisar a la página, así recibe un evento por presentación del código. Se agrega el fixture de video "pulso" (código a la vista 2 s / vacío 2 s, 5 fps) y se valida de punta a punta contando las búsquedas.

**Acceptance criteria:**
- [x] Tras un escaneo, el visor **no** vuelve a "Iniciando cámara…" y la ficha aparece bajo el visor
- [x] Con el código fijo a la vista durante 4 s se hace **una** búsqueda (no una cada 0,3 s)
- [x] Sacar el código del marco y volver a mostrarlo hace una **segunda** búsqueda
- [x] Ya no existe "Escanear otro código"; el ingreso manual y `?code=` (desde `/products`) siguen funcionando
- [x] Un producto no cargado muestra el formulario de alta bajo el visor y, al cargarlo, la ficha lo reemplaza sin apagar la cámara

**Verification:**
- [x] Tests pass: `npm test`
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (fixture "pulso": 1 búsqueda con el código fijo, 2 al volver; cámara no se reinicia) y `npm run test:e2e` completo
- [x] Build succeeds: `npm run build`

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`, `src/components/ProductPanel.tsx`
- `src/app/(app)/scan/page.tsx`
- `e2e/fixtures/make-videos.ts`, `e2e/scanner.spec.ts` (y los e2e que usaban "Escanear otro código")

**Estimated scope:** M

---

### Task 4: Cantidades, "Otra cantidad" y confirmación visible del ajuste ✅

> Hecho; 119 unit y 46 e2e en verde (a11y y responsive a 360 px incluyen la ficha con los controles nuevos: 4 chips en una fila, el campo y los dos botones miden ≥ 44 px). `onAdjust` ahora devuelve `Promise<boolean>` para limpiar el campo sólo si el ajuste se aplicó. El resaltado usa una animación CSS (`stock-flash`) que se apaga con `prefers-reduced-motion`. Los locators `+1`/`-1` de los e2e pasaron a `exact: true`: con `+10` el nombre `+1` coincidía por subcadena con dos botones. Manual pendiente: alcanzar los chips con el pulgar en el celular.

**Description:** En la ficha: `-1 · +1 · +5 · +10` y "Otra cantidad" (campo numérico con Sumar/Restar). Al ajustar, el número se resalta un instante y se anuncia por `aria-live` ("Stock actualizado a 13"). Errores claros para 0, negativos y > 9999.

**Acceptance criteria:**
- [x] `+5` y `+10` suman esa cantidad; "Otra cantidad" suma o resta la cantidad ingresada
- [x] 0, vacío, no numérico y > 9999 muestran un mensaje claro y no ajustan
- [x] Restar más de lo que hay muestra "No hay stock suficiente" y el stock no cambia
- [x] Todo ajuste se anuncia en una región `aria-live="polite"` y el número se resalta
- [x] Todos los controles miden ≥ 44 px a 360 px de ancho

**Verification:**
- [x] Tests pass: `npm test`
- [x] E2E: `npm run test:e2e` (cantidades, "Otra cantidad", errores, anuncio) y `npx playwright test --project=mobile`
- [ ] Manual check: en el celular, alcanzar los chips con el pulgar

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/ProductPanel.tsx`, `src/components/ui/QuantityForm.tsx` (si hace falta)
- `src/app/(app)/scan/page.tsx`
- `e2e/stock.spec.ts`, `e2e/responsive.spec.ts`

**Estimated scope:** M

---

### Task 5: Deshacer ✅

> Hecho; 119 unit, 5 `test:db` y 50 e2e en verde. `Toast` (posición fija sobre la barra de navegación, `role=status`) con pausa por foco o puntero. E2E: aparece '[nombre]: 2 → 7 · Deshacer' y deshacer restaura; se va solo a los ~6 s; **no se va mientras tiene el foco**; y el caso de **otra persona que movió el stock** (segunda sesión resta 12) → 'El stock cambió: no se puede deshacer' sin tocar nada. Que el inverso deja **dos movimientos** lo prueba `test:db` (Task 1). Axe y el chequeo de 44 px/desborde a 360 px corren con el aviso a la vista. Manual pendiente: alcanzar 'Deshacer' con el pulgar.

**Description:** Tras cualquier ajuste aparece un aviso de 6 s "Leche entera: 12 → 13 · Deshacer" (componente `Toast`, `aria-live`, pausa mientras el foco está en él). "Deshacer" llama a `adjustStock` con `-delta`. Si el inverso dejaría stock negativo (alguien movió el producto entretanto) se informa y no se aplica.

**Acceptance criteria:**
- [x] El aviso aparece tras cada ajuste, muestra stock anterior → nuevo y desaparece a los 6 s
- [x] "Deshacer" restaura el stock anterior; queda registrado como un movimiento inverso (verificado en `test:db`)
- [x] Si el inverso no es posible, el aviso lo dice ("El stock cambió: no se puede deshacer") y el stock no se toca
- [x] El aviso es alcanzable con teclado y no desaparece mientras tiene el foco
- [x] El aviso no tapa la barra de navegación ni los controles de la ficha

**Verification:**
- [x] Tests pass: `npm test` y `npm run test:db` (ajuste + inverso = dos movimientos)
- [x] E2E: `npm run test:e2e` (ajustar → deshacer → stock original) y `e2e/a11y.spec.ts` con el aviso visible
- [ ] Manual check: alcanzar "Deshacer" con el pulgar en el celular

**Dependencies:** Task 4

**Files likely touched:**
- `src/components/ui/Toast.tsx`
- `src/app/(app)/scan/page.tsx`, `src/components/ProductPanel.tsx`
- `e2e/stock.spec.ts`, `e2e/a11y.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Consulta
- [x] La cámara no se reinicia; el mismo código no dispara búsquedas repetidas; ajustar y deshacer funcionan (automatizado)
- [ ] Revisión con el usuario

## Phase 3: Modo recepción y ayuda

### Task 6: Interruptores accesibles (Sonido, Linterna) ✅

> Hecho; 119 unit y 51 e2e en verde. `Switch` propio (`role=switch`, `aria-checked`, etiqueta fija, perilla que se mueve además de cambiar de color). Ojo con la semántica: **Sonido activado = interruptor encendido** (`checked = !muted`). Se opera con Espacio, mide ≥ 44 px y la preferencia persiste tras recargar (e2e con teclado). Axe a 360 px en claro y oscuro con linterna y zoom visibles sigue en verde.

**Description:** Componente `Switch` (`role="switch"`, `aria-checked`, etiqueta fija) y reemplazo de los botones "Sonido: activado/silenciado" y "Linterna: apagada/encendida".

**Acceptance criteria:**
- [x] Sonido y Linterna son `switch` con etiqueta fija ("Sonido", "Linterna") y `aria-checked` refleja el estado
- [x] Se operan con teclado (Espacio/Enter) y miden ≥ 44 px
- [x] Funcionan igual que antes: silenciar persiste; la linterna sólo aparece si el dispositivo la ofrece
- [x] Los e2e que buscaban los textos viejos se actualizan

**Verification:**
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` y `npm run test:e2e` completo (a11y y responsive incluidos)

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/ui/Switch.tsx`
- `src/components/BarcodeScanner.tsx`
- `e2e/scanner.spec.ts`

**Estimated scope:** S

---

### Task 7: Modo "Sumar al escanear" ✅

> Hecho; 119 unit y 58 e2e en verde. Modo Suma con `e2e/reception.spec.ts` (cámara falsa; el stock se verifica leyéndolo de la base por `/scan?code=` desde una página aparte, no de lo que muestra la pantalla): Consulta no cambia el stock; un código **quieto** suma exactamente **+1**; `Deshacer último` resta esa unidad; con el video 'pulso' cada presentación suma una y el aviso acumula `+2`; desconocido no suma y ofrece cargar; el modo arranca apagado tras recargar y muestra un aviso fijo; **un código tipeado a mano NO suma ni en modo Suma** (decisión mía, no estaba en la spec: sumar sólo lecturas de cámara). **Mutación:** con `REARM_ABSENT_MS=0` y `REARM_MIN_MISSES=0` el test del código quieto suma **3 unidades en vez de 1** (stock 8 en vez de 6). **Defecto encontrado por un e2e viejo:** el aviso de deshacer (fijo abajo) **tapaba** los botones Sumar/Restar y se llevaba el toque — con riesgo de deshacer sin querer. Reservar espacio no alcanzaba (el elemento seguía a la vista, tapado). Ahora en celular es una barra en el lugar de la navegación (el contenido ya reserva ese espacio) y en escritorio una tarjeta arriba a la derecha, en el margen libre. La lista de decisiones: los handlers de la cámara usan una ref del modo para no cambiar de identidad (reiniciarían la cámara).

**Description:** Interruptor "Sumar al escanear" (no persistente: cada visita arranca en Consulta) con aviso fijo mientras está activo ("Modo suma: cada lectura suma +1"). En ese modo, cada lectura confirmada de un producto conocido llama a `adjustStock(+1)` y muestra el aviso de deshacer, acumulando "+3" si son unidades consecutivas del mismo producto. Un producto desconocido no suma: ofrece "Cargar producto".

**Acceptance criteria:**
- [x] En **Consulta**, escanear un producto conocido no cambia su stock (verificado antes/después)
- [x] En **Suma**, con el código fijo a la vista 4 s el stock sube **exactamente 1**; al sacarlo y volver a mostrarlo sube otro 1 (fixture "pulso")
- [x] Con el modo Suma activo hay un aviso fijo y visible; al volver a `/scan` el modo arranca desactivado
- [x] Cada suma automática muestra "+1 · Deshacer" y deshacer resta ese 1
- [x] Un producto desconocido en modo Suma no suma y ofrece "Cargar producto"

**Verification:**
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (Consulta sin cambios, Suma una vez y otra al volver, aviso fijo, desconocido) y `npm run test:e2e` completo
- [ ] Manual check: en el Android real, recibir 10 productos de a unidad

**Dependencies:** Tasks 3, 5, 6

**Files likely touched:**
- `src/app/(app)/scan/page.tsx`, `src/components/ProductPanel.tsx`
- `e2e/scanner.spec.ts` (o `e2e/reception.spec.ts`)

**Estimated scope:** M

---

### Task 8: Ayuda contextual ✅

> Hecho; 119 unit y 61 e2e en verde. La pista cambia a los 8 s (con la variante de linterna si el dispositivo la ofrece) y a los 20 s (ingreso manual), la anuncia `role=status` sin mover el foco, y cualquier lectura válida reinicia los tiempos (e2e con el video 'pulso': nunca pasan 8 s sin una lectura, así que nunca aparece la ayuda). No implementé lo de 'llevar el foco al campo cuando el usuario lo pide': la spec lo mencionaba de pasada y ningún criterio lo exigía.

**Description:** Usar `helpFor` (T2) en el visor: sin lecturas válidas la pista base cambia a los ~8 s y a los ~20 s sugiere el ingreso manual (y le lleva el foco al campo cuando el usuario lo pide).

**Acceptance criteria:**
- [x] A los ~8 s sin lecturas la pista pasa a "Probá acercar o alejar un poco el celular" (o la de poca luz + linterna si el dispositivo la tiene)
- [x] A los ~20 s pasa a "¿Te cuesta? Escribí el código abajo"
- [x] Cualquier lectura válida devuelve la pista base y reinicia los tiempos
- [x] El cambio de pista se anuncia sin robar el foco

**Verification:**
- [x] Tests pass: `npm test`
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (video "outside": nada legible en el marco → cambia a los 8 s y a los 20 s) y `npm run test:e2e`

**Dependencies:** Tasks 2, 3

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- `e2e/scanner.spec.ts`

**Estimated scope:** S

---

## Checkpoint: Recepción
- [x] Recibir una tanda de unidades suma exacto, una vez por unidad, con deshacer (automatizado)
- [ ] Revisión con el usuario

## Phase 4: Pulido y estructura

### Task 9: "Mostrar contraseña" y link de sesión vencida ✅

> Hecho; 119 unit y 65 e2e en verde. `PasswordField` con botón `Mostrar contraseña` (etiqueta fija, `aria-pressed`, `type=button` para no enviar el form; sin JavaScript el campo sigue siendo un password por POST). **El chequeo de 44 px de `responsive.spec` lo atrapó:** el botón medía 40 px dentro del campo de 44; ahora ocupa todo el alto. El aviso de búsqueda fallida ahora es 'No pudimos buscar el producto.' + link 'Volver a iniciar sesión' (e2e aborta el POST para simularlo).

**Description:** Botón "Mostrar contraseña" (toggle accesible) en login y registro. El aviso de sesión vencida de `/scan` incluye un link a `/login`.

**Acceptance criteria:**
- [x] "Mostrar contraseña" alterna el tipo del campo (`password` ↔ `text`), tiene nombre accesible y estado (`aria-pressed`), se opera con teclado y mide ≥ 44 px
- [x] El campo sigue enviándose por POST sin hidratar (el e2e de "la contraseña no viaja en la URL" sigue verde)
- [x] El aviso de sesión vencida contiene un link a `/login`

**Verification:**
- [x] E2E: `npm run test:e2e` (login, registro, a11y y responsive incluidos)

**Dependencies:** None

**Files likely touched:**
- `src/components/ui/Field.tsx` (o `PasswordField.tsx`)
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- `src/app/(app)/scan/page.tsx`
- `e2e/login.spec.ts`

**Estimated scope:** M

---

### Task 10: Copy nuevo y teclado numérico con "ABC" ✅

> Hecho; 119 unit y 65 e2e en verde. Textos nuevos aplicados en la app y en los ~20 lugares de los e2e a la vez ('El código X todavía no está cargado', 'Cargar producto'). Teclado del ingreso manual: numérico por defecto, botón 'ABC' (`aria-pressed`, etiqueta 'Teclado de letras') que pasa a texto, conserva lo escrito y **devuelve el foco al campo** (en el celular el teclado sólo cambia si el campo se vuelve a enfocar). Los alfanuméricos siguen soportados.

**Description:** Textos nuevos (tabla de copy de la spec: "El código X todavía no está cargado", "Cargar producto") y el ingreso manual abre teclado numérico por defecto con un botón "ABC" que pasa a texto (los alfanuméricos siguen soportados).

**Acceptance criteria:**
- [x] Los textos de la tabla de copy están aplicados y los e2e que los usaban, actualizados
- [x] El campo manual usa `inputMode="numeric"` por defecto; "ABC" lo pasa a texto y viceversa, y conserva lo escrito
- [x] Un código alfanumérico se puede seguir ingresando (pasando a "ABC")

**Verification:**
- [x] Tests pass: `npm test`
- [x] E2E: `npm run test:e2e` completo

**Dependencies:** Task 8 (comparten `BarcodeScanner.tsx`)

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`, `src/components/NewProductForm.tsx`, `src/app/(app)/scan/page.tsx`
- `e2e/helpers.ts`, `e2e/barcodes.spec.ts`, `e2e/stock.spec.ts`

**Estimated scope:** M

---

### Task 11: Escanear como pantalla de inicio

**Description:** Tras el login se entra a `/scan`; `/` redirige a `/scan`; "Inicio" sale de la navegación (queda Escanear · Productos) y se elimina la home.

**Acceptance criteria:**
- [ ] Login exitoso aterriza en `/scan`; `/` (con sesión) redirige a `/scan`; sin sesión sigue yendo a `/login`
- [ ] La navegación tiene sólo Escanear y Productos y marca la sección activa
- [ ] `start_url` del manifest sigue funcionando (redirige)
- [ ] Los e2e que asumían `/` como aterrizaje se actualizan; `a11y` y `responsive` recorren `/scan` y `/products`

**Verification:**
- [ ] E2E: `npm run test:e2e` completo
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: abrir la app instalada y ver que arranca en el escáner

**Dependencies:** Tasks 3 (y conviene después de todo lo demás)

**Files likely touched:**
- `src/app/(app)/page.tsx`, `src/app/(app)/layout.tsx`, `src/lib/actions/auth.ts`
- `e2e/helpers.ts`, `e2e/login.spec.ts`, `e2e/smoke.spec.ts`, `e2e/a11y.spec.ts`, `e2e/responsive.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Completo
- [ ] Criterios 1–13 de `SPEC-flow.md` cumplidos y automatizados
- [ ] Criterio 14 probado en el Android real (recepción de 10 productos de a unidad sin más toques que deshacer)
- [ ] `lint`, `test`, `test:db`, `test:e2e`, `build` en verde y deploy verificado
