# Tasks: LectorBarras — Precisión del escáner

Spec: `SPEC-scanner.md` · Plan y decisiones: `tasks/plan-scanner.md`

**Regla común:** al cerrar cada tarea, `npm test`, `npm run lint`, `npm run build` y `npm run test:e2e` en verde (los 23 e2e existentes son la red de seguridad; no se debilitan ni se borran). Un commit y push por tarea.

## Phase 1: Lógica y backend universales

### Task 1: `barcode.ts` — validación, normalización y candidatos de búsqueda ✅

> Hecho; 19 tests con vectores reales de cada formato (EAN-13, EAN-8, UPC-A, UPC-E en sus 4 casos de expansión, ITF-14) y todos los caminos de normalización y candidatos.

**Description:** Módulo puro, fuente de verdad única. Valida el dígito verificador GS1 (EAN-13, EAN-8, UPC-A, UPC-E, ITF-14), normaliza a GTIN-13 (UPC-A → `0`+12; UPC-E → expandir a UPC-A → `0`+12; EAN-13, EAN-8, ITF-14 y alfanuméricos sin tocar), genera los candidatos de búsqueda (canónico + variante de 12 dígitos) y define la validación relajada del ingreso manual (4–64 ASCII imprimibles, sin espacios en los extremos).

**Acceptance criteria:**
- [x] `isValidGs1(code, format)` acepta códigos válidos y rechaza checksum inválido para EAN-13/EAN-8/UPC-A/UPC-E/ITF-14
- [x] `normalizeBarcode(code, format?)` convierte UPC-A y UPC-E a GTIN-13 y deja el resto igual; recorta espacios
- [x] `barcodeCandidates(code)` devuelve el canónico y, si es GTIN-13 que empieza con `0`, también la variante de 12 dígitos (y viceversa), sin duplicados
- [x] `isValidBarcodeInput(code)` acepta Code 128/39 y numéricos internos; rechaza vacío, < 4, > 64, espacios en los extremos y caracteres no imprimibles

**Verification:**
- [x] Tests pass: `npm test -- src/lib/barcode.test.ts` (vectores reales de cada formato, válidos e inválidos)
- [x] Build succeeds: `npm run build`

**Dependencies:** None

**Files likely touched:**
- `src/lib/barcode.ts`, `src/lib/barcode.test.ts`

**Estimated scope:** S

---

### Task 2: Backend e ingreso manual universales ✅

> Hecho; 62 unit y 26 e2e en verde. Búsqueda exacta por código (`searchProducts`) también usa los candidatos, y los links de `/products` a `/scan?code=` ahora van con `encodeURIComponent` (un Code 128 con `&`, `#` o espacios los rompía). El caso 'producto viejo con 12 dígitos' se cubre en unit con la DB simulada (`products.lookup.test.ts`): no se puede crear uno viejo desde la UI porque ahora todo se normaliza.

**Description:** Usar `barcode.ts` en `createProduct` (validar con la regla relajada, guardar el código normalizado), en `lookupProductByBarcode` (buscar por candidatos, devolver el código normalizado en `found:false`) y en el ingreso manual del escáner (validación y mensaje). Se mantiene el orden "validar antes de `auth()`".

**Acceptance criteria:**
- [x] `createProduct` acepta un Code 128 alfanumérico (ej. `ABC-1234`) y lo guarda tal cual; sigue rechazando vacío, muy corto o muy largo
- [x] Guardar un UPC-A de 12 dígitos lo persiste como GTIN-13 (`0`+12); dar de alta después el EAN-13 equivalente informa "Ya existe un producto con ese código"
- [x] `lookupProductByBarcode` encuentra un producto guardado con 12 dígitos al buscarlo por su EAN-13 equivalente y viceversa
- [x] El ingreso manual acepta códigos alfanuméricos (`inputMode` de texto) y el mensaje de error refleja la regla nueva
- [x] Los 23 e2e existentes no cambian de comportamiento

**Verification:**
- [x] Tests pass: `npm test` (validación de `createProduct`, candidatos)
- [x] E2E: `npm run test:e2e` completo + nuevo `e2e/barcodes.spec.ts` (alta manual de Code 128, y equivalencia 12↔13 dígitos)
- [x] Build succeeds: `npm run build`

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/actions/products.ts`, `src/lib/actions/products.test.ts`
- `src/lib/scanner.ts` (`isValidManualBarcode`), `src/lib/scanner.test.ts`
- `src/components/BarcodeScanner.tsx` (mensaje/`inputMode`)
- `e2e/barcodes.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Códigos
- [x] `test`, `lint`, `build`, `test:e2e` en verde
- [x] Code 128 alfanumérico se da de alta a mano y se encuentra; UPC-A y EAN-13 equivalentes son el mismo producto

## Phase 2: Infraestructura de cámara y marco funcional

### Task 3: Cámara falsa para e2e (generador de video + config + prueba base) ✅

> Hecho; 27 e2e en verde. **La cámara falsa funciona en este entorno** (Windows, chromium headless): el escáner actual lee un EAN-13 sintético y muestra 'No existe…' con ese código. El manual check de mirar el video se reemplazó por la propia lectura (si zxing decodifica el código, el video es legible). Hallazgos: `@zxing/library` sólo trae el escritor de QR (los de 1D están comentados), así que EAN-13 y Code 128 se codifican en `make-videos.ts` (Code 128 reutiliza `Code128Reader.CODE_PATTERNS`); `launchOptions` no se puede cambiar por `describe`, por eso el fixture `cameraPage(video)` (`e2e/fixtures/camera.ts`) lanza un Chromium por test; `next build` también tipa `e2e/`, así que los tipos de estos archivos importan.

> Hecho; 27 e2e en verde. **La cámara falsa funciona en este entorno** (Windows, chromium headless): el escáner actual lee un EAN-13 sintético y muestra 'No existe…' con ese código. El manual check de mirar el video se reemplazó por la propia lectura (si zxing decodifica el código, el video es legible). Hallazgos: `@zxing/library` sólo trae el escritor de QR (los de 1D están comentados), así que EAN-13 y Code 128 se codifican en `make-videos.ts` (Code 128 reutiliza `Code128Reader.CODE_PATTERNS`); `launchOptions` no se puede cambiar por `describe`, por eso el fixture `cameraPage(video)` (`e2e/fixtures/camera.ts`) lanza un Chromium por test; `next build` también tipa `e2e/`. **Carrera corregida en un e2e de la Task 2:** el test de UPC-A/EAN-13 esperaba `Código: …`, texto que el formulario de alta también muestra, así que navegaba con el alta todavía en vuelo y fallaba 3 de cada 4 veces con `--repeat-each`. Se descartó un problema de la base con mediciones (40/40 lecturas consistentes tras escribir); el test ahora espera `Stock actual`.

**Description:** Poder probar la lectura de verdad. Un script genera videos y4m sintéticos (fondo claro + uno o dos códigos dibujados con el `MultiFormatWriter` de `@zxing/library`) en una carpeta ignorada por git, en `globalSetup`. Un proyecto de Playwright arranca Chromium con `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<video>`. Prueba base contra el **escáner actual**: un EAN-13 centrado se lee y aparece el producto.

**Acceptance criteria:**
- [x] El generador produce, sin dependencias nuevas, videos y4m para: EAN-13 centrado, EAN-13 en un rincón, dos EAN-13 (uno centrado, otro en el rincón), Code 128 alfanumérico centrado
- [x] `e2e/scanner.spec.ts` (proyecto de cámara) arranca con permiso de cámara concedido y ve el video
- [x] El escáner actual lee el EAN-13 centrado y muestra la ficha del producto (o "No existe…" con ese código)
- [x] Los videos generados no se commitean (`.gitignore`)

**Verification:**
- [x] E2E: `npx playwright test e2e/scanner.spec.ts`
- [x] E2E: `npm run test:e2e` completo (los otros proyectos no se afectan)
- [ ] Manual check: abrir uno de los videos generados en un visor y confirmar que el código es legible

**Dependencies:** None (riesgo alto: se hace temprano)

**Files likely touched:**
- `e2e/fixtures/make-videos.ts`, `e2e/global-setup.ts`
- `playwright.config.ts`, `.gitignore`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

### Task 4: `scan-confirm.ts` y `scan-geometry.ts` (lógica pura) ✅

> Hecho; 72 unit en verde. Las constantes (`GUIDE`, `CONFIRM_READS`, `CONFIRM_WINDOW_MS`, `SCAN_INTERVAL_MS`) viven en `scanner.ts` con el porqué de cada valor. El primer caso de geometría (video y contenedor 16:9) da exactamente la zona que usan los videos de la cámara falsa (x 64–1216, y 162–558), así que el e2e de la Task 5 y estos tests hablan del mismo marco.

**Description:** Dos módulos puros. `createConfirmer(needed=3, windowMs=1500)` acepta un código recién tras N lecturas iguales dentro de la ventana. `guideToVideoRect(...)` convierte el marco (en % del contenedor visible) al rectángulo en píxeles del video, compensando el recorte de `object-cover`.

**Acceptance criteria:**
- [x] El confirmador rechaza 1 y 2 lecturas, acepta la 3.ª igual, se reinicia si cambia el código o vence la ventana
- [x] `guideToVideoRect` da el rectángulo correcto cuando el video es más ancho, más angosto o igual de proporción que el contenedor, y nunca sale de los límites del video
- [x] Constantes con nombre y comentario en `scanner.ts`: tamaño del marco (≈ 90 % × 55 %), lecturas necesarias, ventana, intervalo de lectura

**Verification:**
- [x] Tests pass: `npm test -- src/lib/scan-confirm.test.ts src/lib/scan-geometry.test.ts`

**Dependencies:** None

**Files likely touched:**
- `src/lib/scan-confirm.ts`, `src/lib/scan-confirm.test.ts`
- `src/lib/scan-geometry.ts`, `src/lib/scan-geometry.test.ts`
- `src/lib/scanner.ts`

**Estimated scope:** S

---

### Task 5: Marco funcional — bucle de lectura sobre canvas (ROI) ✅

> Hecho; 72 unit y 31 e2e en verde. Bucle propio en `scan-loop.ts` (recorta el marco → canvas → decodificador, sin encolar) y motor zxing en `scan-decoder.ts`. El overlay del marco se dibuja desde la misma constante `GUIDE` que la zona decodificada. **Verificado con mutación:** con `GUIDE` a pantalla completa el test 'FUERA del marco' falla (lee el código de afuera); se revirtió. Se agregó un control positivo (`outsideCentered`: el mismo código chico de afuera pero centrado sí se lee), para que el negativo no pueda pasar por 'el código era ilegible'.

**Description:** Reemplazar `decodeFromConstraints` por un bucle propio: cada ~100 ms (sin encolar lecturas), dibujar en un canvas sólo la región del marco y decodificarla con zxing (`decodeFromCanvas`). El marco de la pantalla pasa a ser tolerante (≈ 90 % × 55 %) y es exactamente la zona leída. Sin confirmación todavía (eso es la Task 6).

**Acceptance criteria:**
- [x] Un código dentro del marco se lee y muestra el producto en ≤ 3 s
- [x] Un código fuera del marco **no** se lee (el escáner sigue esperando)
- [x] Con dos códigos en cuadro, uno dentro y otro fuera, se lee sólo el de adentro
- [x] Sin lecturas encoladas: si una decodificación tarda más que el intervalo, no se apilan
- [x] El ingreso manual y el fallo de cámara siguen igual

**Verification:**
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (dentro / fuera / dos códigos)
- [x] E2E: `npm run test:e2e` completo
- [x] Build succeeds: `npm run build`

**Dependencies:** Tasks 3, 4

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- `src/lib/scanner.ts`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Marco
- [x] e2e: dentro se lee, fuera no, con dos códigos sólo el de adentro
- [ ] Revisión con el usuario

## Phase 3: Precisión y formatos

### Task 6: Confirmación de 3 lecturas, formatos universales y normalización en la lectura ✅

> Hecho; 77 unit y 33 e2e en verde (cuentas reales; la nota de la Task 5 decía 31 por error, eran 30). `acceptReading` (en `barcode.ts`) filtra cada lectura: formato conocido, dígito verificador, ITF sólo como GTIN-14 válido (los ITF de otro largo dan demasiadas lecturas falsas), y 4–64 ASCII; después la confirma el `createConfirmer` (3 iguales en 1,5 s) y se resetea al confirmar. E2E por cámara: EAN-13, **Code 128 alfanumérico de punta a punta (alta incluida)**, **QR cuadrado** (cabe en el marco de 396 px de alto), y un EAN-13 con dígito verificador adulterado que **nunca** se lee. UPC-A/UPC-E/ITF-14/Code 39 se cubren en unit (`acceptReading`), no por cámara.

**Description:** Conectar `createConfirmer` al bucle: un código se acepta sólo tras 3 lecturas iguales. Activar los formatos universales (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, QR) en zxing y hacer que cada lectura devuelva `{text, format}`. Filtrar cada lectura: largo mínimo, dígito verificador para los formatos GS1, y normalizar con `barcode.ts` antes de confirmar y de llamar a `onDetected`.

**Acceptance criteria:**
- [x] Una lectura suelta (o dos) no dispara `onDetected`; la tercera igual sí
- [x] Un EAN/UPC con checksum inválido se descarta y nunca llega a `onDetected`
- [x] Un Code 128 alfanumérico se lee de punta a punta: se da de alta y se vuelve a encontrar
- [x] Un UPC-A leído llega como GTIN-13 (mismo producto que su EAN-13)
- [x] Lecturas de un código y luego de otro distinto no se mezclan en la confirmación

**Verification:**
- [x] Tests pass: `npm test` (filtro de lectura: checksum, largo mínimo, normalización)
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (Code 128 de punta a punta, dentro/fuera/dos siguen en verde)
- [x] E2E: `npm run test:e2e` completo

**Dependencies:** Tasks 1, 4, 5

**Files likely touched:**
- `src/lib/scanner.ts` (formatos, `acceptRead`)
- `src/lib/scanner.test.ts`
- `src/components/BarcodeScanner.tsx`
- `e2e/scanner.spec.ts`

**Estimated scope:** M

---

### Task 7: Detector nativo (`BarcodeDetector`) con respaldo zxing ✅

> Hecho; 85 unit y 34 e2e en verde. `createDecoder()` usa `BarcodeDetector` si existe y soporta alguno de los 8 formatos, con zxing de respaldo permanente si el nativo falla en ejecución. Con varios códigos en el marco el nativo elige el más grande. Además de los unit con un detector simulado, hay un **e2e con `BarcodeDetector` simulado** (`addInitScript`) que prueba el cableado real: el motor nativo se usa (se cuentan las llamadas), pasan las 3 lecturas y un UPC-A de 12 dígitos llega como GTIN-13. **Sigue pendiente a mano en el Android real**: que la precisión del motor nativo sea la esperada con productos reales.

**Description:** Interfaz de motor `canvas → {text, format} | null` con dos implementaciones. Si `BarcodeDetector` existe y soporta los formatos, se usa; si no, zxing. El resultado pasa por el mismo filtro y normalización (Task 6).

**Acceptance criteria:**
- [x] Con `BarcodeDetector` disponible se usa y sus formatos se traducen a los mismos nombres que zxing
- [x] Sin `BarcodeDetector` (o si falla al crearse) se usa zxing sin mostrar error
- [x] El código de UPC-A que devuelva el motor nativo pasa por `normalize()` y da el mismo producto que zxing

**Verification:**
- [x] Tests pass: `npm test` (selección de motor y traducción de formatos con un `BarcodeDetector` simulado)
- [x] E2E: `npm run test:e2e` completo (usa zxing; sin regresiones)
- [ ] Manual check: en el Android real, comprobar cuál motor se usa y que lee mejor con desenfoque/ángulo — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/lib/scan-decoder.ts`, `src/lib/scan-decoder.test.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

## Phase 4: Imagen y guía

 ✅## Phase 4: Imagen y guía

### Task 8: Cámara — enfoque continuo, linterna y zoom ✅

> Hecho; 98 unit y 36 e2e en verde. `scan-camera.ts` descubre linterna, zoom y enfoque continuo con `getCapabilities()` (todo opcional y tolerante a fallos). E2E: en la webcam falsa **no** aparecen Linterna ni Zoom, y con capacidades simuladas de Android sí aparecen y aplican `focusMode: continuous` al arrancar, `torch: true` al tocar la linterna y `zoom: 2.5` con el slider. **Pendiente a mano en el Android real**: que la linterna y el zoom funcionen de verdad.

**Description:** Pedir enfoque continuo (`focusMode: "continuous"`) cuando el dispositivo lo declare. Mostrar un botón de **linterna** y un control de **zoom** sólo si `track.getCapabilities()` los soporta (Android Chrome); en el resto no aparecen. La lógica de capacidades es pura y testeable.

**Acceptance criteria:**
- [x] Sin capacidad de linterna o zoom, no se muestran controles ni errores
- [x] Con capacidad, la linterna se enciende/apaga (`aria-pressed`) y el zoom respeta el rango `min`/`max`/`step` del dispositivo
- [x] Los controles miden ≥ 44 px y funcionan en ambos esquemas de color
- [x] Si `applyConstraints` falla, el escaneo sigue funcionando y no se muestra un error

**Verification:**
- [x] Tests pass: `npm test` (derivación de controles desde `getCapabilities()` simulado)
- [x] E2E: `npm run test:e2e` completo (en la cámara falsa no hay linterna: los controles no aparecen)
- [ ] Manual check: en el Android real, linterna y zoom funcionan — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/lib/scan-camera.ts`, `src/lib/scan-camera.test.ts`
- `src/components/BarcodeScanner.tsx`

**Estimated scope:** M

---

### Task 9: Guía viva y sonido al confirmar (sin vibración) ✅

> Hecho; 99 unit y 39 e2e en verde. Marco en tres estados (`Poné el código dentro del marco` → `Leyendo…` con borde amarillo punteado → `✓ Código confirmado` con borde verde), cada uno con texto distinto además del color. Se quitó la vibración de `feedback.ts`; el beep suena al confirmar. E2E: la pista es visible, el estado confirmado se ve (con la búsqueda demorada 3 s vía `page.route`) y `navigator.vibrate` se espía y **nunca** se llama. Un test aparte corre axe y el chequeo de desborde a 360 px **con la cámara activa y linterna/zoom visibles**, en claro y oscuro (las pantallas de a11y y responsive anteriores no tenían cámara y no cubrían el visor). El test unitario de `feedback` reimporta el módulo por caso: cachea el `AudioContext` y, sin eso, los casos posteriores heredaban el del primero y pasaban sin probar nada.

**Description:** El marco cambia de estado: buscando (borde neutro) → detectado (borde de acento, hay una lectura sin confirmar) → confirmado (borde de éxito + texto), con una pista visible ("Poné el código dentro del marco"). Los estados se distinguen sin depender sólo del color. Se quita la vibración de `feedback.ts` y el sonido pasa a sonar **al confirmar** (no a la primera lectura).

**Acceptance criteria:**
- [x] Tres estados visibles del marco, cada uno con un texto o forma distinta además del color
- [x] La pista está siempre visible mientras la cámara funciona
- [x] El dispositivo nunca vibra: no queda ninguna llamada a `navigator.vibrate`
- [x] El sonido suena una vez al confirmar (salvo silenciado) y no en lecturas sin confirmar

**Verification:**
- [x] Tests pass: `npm test` (`feedback.ts` sin vibración; el sonido se dispara sólo al confirmar)
- [x] E2E: `npx playwright test e2e/scanner.spec.ts` (el estado "confirmado" es visible tras leer) y `npm run test:e2e` completo
- [x] E2E: `npx playwright test --project=mobile` y `e2e/a11y.spec.ts` siguen en verde (la guía no rompe accesibilidad ni tamaños)
- [ ] Manual check: en el Android real, sonido al confirmar y ningún zumbido — **pendiente, celular**

**Dependencies:** Task 6

**Files likely touched:**
- `src/components/BarcodeScanner.tsx`
- `src/lib/feedback.ts`, `src/lib/feedback.test.ts`
- `e2e/scanner.spec.ts`, `e2e/a11y.spec.ts`

**Estimated scope:** M

---

## Checkpoint: Completo
- [x] Criterios 1–10 de `SPEC-scanner.md` cumplidos y automatizados
- [ ] Criterio 11 probado en el Android real (10 productos, ITF-14 / Code 128 / QR si hay, linterna, zoom, poca luz)
- [x] `lint`, `test` (99), `test:e2e` (39), `build` en verde (deploy: se verifica tras este push)
