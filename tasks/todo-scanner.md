# Tasks: LectorBarras — Precisión del escáner

Spec: `SPEC-scanner.md` · Plan y decisiones: `tasks/plan-scanner.md`

**Regla común:** al cerrar cada tarea, `npm test`, `npm run lint`, `npm run build` y `npm run test:e2e` en verde (los 23 e2e existentes son la red de seguridad; no se debilitan ni se borran). Un commit y push por tarea.

## Phase 1: Lógica y backend universales

### Task 1: `barcode.ts` — validación, normalización y candidatos de búsqueda

**Description:** Módulo puro, fuente de verdad única. Valida el dígito verificador GS1 (EAN-13, EAN-8, UPC-A, UPC-E, ITF-14), normaliza a GTIN-13 (UPC-A → `0`+12; UPC-E → expandir a UPC-A → `0`+12; EAN-13, EAN-8, ITF-14 y alfanuméricos sin tocar), genera los candidatos de búsqueda (canónico + variante de 12 dígitos) y define la validación relajada del ingreso manual (4–64 ASCII imprimibles, sin espacios en los extremos).

**Acceptance criteria:**
- [ ] `isValidGs1(code, format)` acepta códigos válidos y rechaza checksum inválido para EAN-13/EAN-8/UPC-A/UPC-E/ITF-14
- [ ] `normalizeBarcode(code, format?)` convierte UPC-A y UPC-E a GTIN-13 y deja el resto igual; recorta espacios
- [ ] `barcodeCandidates(code)` devuelve el canónico y, si es GTIN-13 que empieza con `0`, también la variante de 12 dígitos (y viceversa), sin duplicados
- [ ] `isValidBarcodeInput(code)` acepta Code 128/39 y numéricos internos; rechaza vacío, < 4, > 64, espacios en los extremos y caracteres no imprimibles

**Verification:**
- [ ] Tests pass: `npm test -- src/lib/barcode.test.ts` (vectores reales de cada formato, válidos e inválidos)
- [ ] Build succeeds: `npm run build`

**Dependencies:** None

**Files likely touched:**
- `src/lib/barcode.ts`, `src/lib/barcode.test.ts`

**Estimated scope:** S

---

### Task 2: Backend e ingreso manual universales

**Description:** Usar `barcode.ts` en `createProduct` (validar con la regla relajada, guardar el código normalizado), en `lookupProductByBarcode` (buscar por candidatos, devolver el código normalizado en `found:false`) y en el ingreso manual del escáner (validación y mensaje). Se mantiene el orden "validar antes de `auth()`".

**Acceptance criteria:**
- [ ] `createProduct` acepta un Code 128 alfanumérico (ej. `ABC-1234`) y lo guarda tal cual; sigue rechazando vacío, muy corto o muy largo
- [ ] Guardar un UPC-A de 12 dígitos lo persiste como GTIN-13 (`0`+12); dar de alta después el EAN-13 equivalente informa "Ya existe un producto con ese código"
- [ ] `lookupProductByBarcode` encuentra un producto guardado con 12 dígitos al buscarlo por su EAN-13 equivalente y viceversa
- [ ] El ingreso manual acepta códigos alfanuméricos (`inputMode` de texto) y el mensaje de error refleja la regla nueva
- [ ] Los 23 e2e existentes no cambian de comportamiento

**Verification:**
- [ ] Tests pass: `npm test` (validación de `createProduct`, candidatos)
- [ ] E2E: `npm run test:e2e` completo + nuevo `e2e/barcodes.spec.ts` (alta manual de Code 128, y equivalencia 12↔13 dígitos)
- [ ] Build succeeds: `npm run build`

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/actions/products.ts`, `src/lib/actions/products.test.ts`
- `src/lib/scanner.ts` (`isValidManualBarcode`), `src/lib/scanner.test.ts`
- `src/components/BarcodeScanner.tsx` (mensaje/`inputMode`)
- `e2e/barcodes.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Códigos
- [ ] `test`, `lint`, `build`, `test:e2e` en verde
- [ ] Code 128 alfanumérico se da de alta a mano y se encuentra; UPC-A y EAN-13 equivalentes son el mismo producto

## Phase 2: Infraestructura de cámara y marco funcional

### Task 3: Cámara falsa para e2e (generador de video + config + prueba base)

**Description:** Poder probar la lectura de verdad. Un script genera videos y4m sintéticos (fondo claro + uno o dos códigos dibujados con el `MultiFormatWriter` de `@zxing/library`) en una carpeta ignorada por git, en `globalSetup`. Un proyecto de Playwright arranca Chromium con `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<video>`. Prueba base contra el **escáner actual**: un EAN-13 centrado se lee y aparece el producto.

**Acceptance criteria:**
- [ ] El generador produce, sin dependencias nuevas, videos y4m para: EAN-13 centrado, EAN-13 en un rincón, dos EAN-13 (uno centrado, otro en el rincón), Code 128 alfanumérico centrado
- [ ] `e2e/scanner.spec.ts` (proyecto de cámara) arranca con permiso de cámara concedido y ve el video
- [ ] El escáner actual lee el EAN-13 centrado y muestra la ficha del producto (o "No existe…" con ese código)
- [ ] Los videos generados no se commitean (`.gitignore`)

**Verification:**
- [ ] E2E: `npx playwright test e2e/scanner.spec.ts`
- [ ] E2E: `npm run test:e2e` completo (los otros proyectos no se afectan)
- [ ] Manual check: abrir uno de los videos generados en un visor y confirmar que el código es legible

**Dependencies:** None (riesgo alto: se hace temprano)

**Files likely touched:**
- `e2e/fixtures/make-videos.ts`, `e2e/global-setup.ts`
- `playwright.config.ts`, `.gitignore`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

### Task 4: `scan-confirm.ts` y `scan-geometry.ts` (lógica pura)

**Description:** Dos módulos puros. `createConfirmer(needed=3, windowMs=1500)` acepta un código recién tras N lecturas iguales dentro de la ventana. `guideToVideoRect(...)` convierte el marco (en % del contenedor visible) al rectángulo en píxeles del video, compensando el recorte de `object-cover`.

**Acceptance criteria:**
- [ ] El confirmador rechaza 1 y 2 lecturas, acepta la 3.ª igual, se reinicia si cambia el código o vence la ventana
- [ ] `guideToVideoRect` da el rectángulo correcto cuando el video es más ancho, más angosto o igual de proporción que el contenedor, y nunca sale de los límites del video
- [ ] Constantes con nombre y comentario en `scanner.ts`: tamaño del marco (≈ 90 % × 55 %), lecturas necesarias, ventana, intervalo de lectura

**Verification:**
- [ ] Tests pass: `npm test -- src/lib/scan-confirm.test.ts src/lib/scan-geometry.test.ts`

**Dependencies:** None

**Files likely touched:**
- `src/lib/scan-confirm.ts`, `src/lib/scan-confirm.test.ts`
- `src/lib/scan-geometry.ts`, `src/lib/scan-geometry.test.ts`
- `src/lib/scanner.ts`

**Estimated scope:** S

---

### Task 5: Marco funcional — bucle de lectura sobre canvas (ROI)

**Description:** Reemplazar `decodeFromConstraints` por un bucle propio: cada ~100 ms (sin encolar lecturas), dibujar en un canvas sólo la región del marco y decodificarla con zxing (`decodeFromCanvas`). El marco de la pantalla pasa a ser tolerante (≈ 90 % × 55 %) y es exactamente la zona leída. Sin confirmación todavía (eso es la Task 6).

**Acceptance criteria:**
- [ ] Un código dentro del marco se lee y muestra el producto en ≤ 3 s
- [ ] Un código fuera del marco **no** se lee (el escáner sigue esperando)
- [ ] Con dos códigos en cuadro, uno dentro y otro fuera, se lee sólo el de adentro
- [ ] Sin lecturas encoladas: si una decodificación tarda más que el intervalo, no se apilan
- [ ] El ingreso manual y el fallo de cámara siguen igual

**Verification:**
- [ ] E2E: `npx playwright test e2e/scanner.spec.ts` (dentro / fuera / dos códigos)
- [ ] E2E: `npm run test:e2e` completo
- [ ] Build succeeds: `npm run build`

**Dependencies:** Tasks 3, 4

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- `src/lib/scanner.ts`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Marco
- [ ] e2e: dentro se lee, fuera no, con dos códigos sólo el de adentro
- [ ] Revisión con el usuario

## Phase 3: Precisión y formatos

### Task 6: Confirmación de 3 lecturas, formatos universales y normalización en la lectura

**Description:** Conectar `createConfirmer` al bucle: un código se acepta sólo tras 3 lecturas iguales. Activar los formatos universales (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, QR) en zxing y hacer que cada lectura devuelva `{text, format}`. Filtrar cada lectura: largo mínimo, dígito verificador para los formatos GS1, y normalizar con `barcode.ts` antes de confirmar y de llamar a `onDetected`.

**Acceptance criteria:**
- [ ] Una lectura suelta (o dos) no dispara `onDetected`; la tercera igual sí
- [ ] Un EAN/UPC con checksum inválido se descarta y nunca llega a `onDetected`
- [ ] Un Code 128 alfanumérico se lee de punta a punta: se da de alta y se vuelve a encontrar
- [ ] Un UPC-A leído llega como GTIN-13 (mismo producto que su EAN-13)
- [ ] Lecturas de un código y luego de otro distinto no se mezclan en la confirmación

**Verification:**
- [ ] Tests pass: `npm test` (filtro de lectura: checksum, largo mínimo, normalización)
- [ ] E2E: `npx playwright test e2e/scanner.spec.ts` (Code 128 de punta a punta, dentro/fuera/dos siguen en verde)
- [ ] E2E: `npm run test:e2e` completo

**Dependencies:** Tasks 1, 4, 5

**Files likely touched:**
- `src/lib/scanner.ts` (formatos, `acceptRead`)
- `src/lib/scanner.test.ts`
- `src/components/BarcodeScanner.tsx`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

### Task 7: Detector nativo (`BarcodeDetector`) con respaldo zxing

**Description:** Interfaz de motor `canvas → {text, format} | null` con dos implementaciones. Si `BarcodeDetector` existe y soporta los formatos, se usa; si no, zxing. El resultado pasa por el mismo filtro y normalización (Task 6).

**Acceptance criteria:**
- [ ] Con `BarcodeDetector` disponible se usa y sus formatos se traducen a los mismos nombres que zxing
- [ ] Sin `BarcodeDetector` (o si falla al crearse) se usa zxing sin mostrar error
- [ ] El código de UPC-A que devuelva el motor nativo pasa por `normalize()` y da el mismo producto que zxing

**Verification:**
- [ ] Tests pass: `npm test` (selección de motor y traducción de formatos con un `BarcodeDetector` simulado)
- [ ] E2E: `npm run test:e2e` completo (usa zxing; sin regresiones)
- [ ] Manual check: en el Android real, comprobar cuál motor se usa y que lee mejor con desenfoque/ángulo — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/lib/scan-decoder.ts`, `src/lib/scan-decoder.test.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

## Phase 4: Imagen y guía

### Task 8: Cámara — enfoque continuo, linterna y zoom

**Description:** Pedir enfoque continuo (`focusMode: "continuous"`) cuando el dispositivo lo declare. Mostrar un botón de **linterna** y un control de **zoom** sólo si `track.getCapabilities()` los soporta (Android Chrome); en el resto no aparecen. La lógica de capacidades es pura y testeable.

**Acceptance criteria:**
- [ ] Sin capacidad de linterna o zoom, no se muestran controles ni errores
- [ ] Con capacidad, la linterna se enciende/apaga (`aria-pressed`) y el zoom respeta el rango `min`/`max`/`step` del dispositivo
- [ ] Los controles miden ≥ 44 px y funcionan en ambos esquemas de color
- [ ] Si `applyConstraints` falla, el escaneo sigue funcionando y no se muestra un error

**Verification:**
- [ ] Tests pass: `npm test` (derivación de controles desde `getCapabilities()` simulado)
- [ ] E2E: `npm run test:e2e` completo (en la cámara falsa no hay linterna: los controles no aparecen)
- [ ] Manual check: en el Android real, linterna y zoom funcionan — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/lib/scan-camera.ts`, `src/lib/scan-camera.test.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

### Task 9: Guía viva y sonido al confirmar (sin vibración)

**Description:** El marco cambia de estado: buscando (borde neutro) → detectado (borde de acento, hay una lectura sin confirmar) → confirmado (borde de éxito + texto), con una pista visible ("Poné el código dentro del marco"). Los estados se distinguen sin depender sólo del color. Se quita la vibración de `feedback.ts` y el sonido pasa a sonar **al confirmar** (no a la primera lectura).

**Acceptance criteria:**
- [ ] Tres estados visibles del marco, cada uno con un texto o forma distinta además del color
- [ ] La pista está siempre visible mientras la cámara funciona
- [ ] El dispositivo nunca vibra: no queda ninguna llamada a `navigator.vibrate`
- [ ] El sonido suena una vez al confirmar (salvo silenciado) y no en lecturas sin confirmar

**Verification:**
- [ ] Tests pass: `npm test` (`feedback.ts` sin vibración; el sonido se dispara sólo al confirmar)
- [ ] E2E: `npx playwright test e2e/scanner.spec.ts` (el estado "confirmado" es visible tras leer) y `npm run test:e2e` completo
- [ ] E2E: `npx playwright test --project=mobile` y `e2e/a11y.spec.ts` siguen en verde (la guía no rompe accesibilidad ni tamaños)
- [ ] Manual check: en el Android real, sonido al confirmar y ningún zumbido — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- `src/lib/feedback.ts`, `src/lib/feedback.test.ts`
- `e2e/scanner.spec.ts`, `e2e/a11y.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Completo
- [ ] Criterios 1–10 de `SPEC-scanner.md` cumplidos y automatizados
- [ ] Criterio 11 probado en el Android real (10 productos, ITF-14 / Code 128 / QR si hay, linterna, zoom, poca luz)
- [ ] `lint`, `test`, `test:e2e`, `build` en verde y deploy verificado
