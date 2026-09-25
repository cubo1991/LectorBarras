# Spec: LectorBarras — Precisión del escáner

Complementa a `SPEC.md` y `SPEC-front.md`. Alcance principal: **el componente de lectura por cámara** (`BarcodeScanner`, `src/lib/scanner.ts`). Por el requisito de universalidad de formatos, también toca la **validación y normalización del código de barras** en el backend (`createProduct`, `lookupProductByBarcode`) y en el ingreso manual; no cambia el esquema de la base de datos ni las demás pantallas.

## Objective

Hoy el escáner decodifica **todo el cuadro** con zxing a ~2 lecturas por segundo y acepta la **primera** lectura. El marco que se ve en pantalla es decorativo. Eso produce problemas que en un inventario importan más que la velocidad:

1. **Lecturas fallidas o lentas**: códigos chicos, con poca luz, desenfocados o inclinados no se leen (ya se vio en la webcam de la notebook).
2. **Lecturas equivocadas**: si hay otro código en el cuadro (el producto de al lado en la góndola), puede leerse ese, y una lectura mala que igual pasa el checksum ajusta el stock del producto incorrecto.
3. **Formatos limitados**: sólo EAN-13, UPC-A y EAN-8, y el sistema entero rechaza cualquier código que no sean 8–14 dígitos.
4. **El mismo producto con dos códigos**: un UPC-A puede leerse como 12 dígitos o como EAN-13 con un `0` adelante según el motor de lectura; sin normalizar, terminaría duplicado en el inventario.

**Objetivo:** un lector **lo más preciso posible** (muy pocas lecturas fallidas y prácticamente ninguna equivocada) y **universal** para comercios chicos: que lea lo que realmente traen los productos y etiquetas de un comercio, sin que el usuario tenga que pensar en el formato. El marco en pantalla es funcional: *se lee sólo lo que está dentro del marco*, y es **generoso** (tolerante) para no exigir puntería.

**Usuario / dispositivo:** comercios chicos, equipo interno. **Android con Chrome** es el dispositivo principal; notebook con webcam como secundario.

**Qué se construye**
1. **Marco funcional y tolerante (ROI):** sólo se decodifica el área dentro del borde, que es grande (≈ 90 % del ancho × 55 % del alto del visor) para admitir códigos de barras apaisados y QR cuadrados sin exigir puntería.
2. **Confirmación por 3 lecturas iguales** dentro de una ventana corta, más dígito verificador válido cuando el formato lo tiene.
3. **Formatos universales de comercio chico:** EAN-13, EAN-8, UPC-A, UPC-E (góndola, incluidos importados), **Code 128** y **Code 39** (etiquetas propias, balanza, artículos sin código comercial), **ITF/ITF-14** (cajas y bultos de mayoristas) y **QR** (etiquetas internas). Quedan afuera Codabar, DataMatrix, PDF417 y Aztec (raros en este rubro).
4. **Normalización del código:** los códigos comerciales numéricos se guardan y buscan en forma canónica (GTIN-13: un UPC-A de 12 dígitos y su EAN-13 con `0` adelante son el mismo producto; UPC-E se expande). Los productos ya cargados con 12 dígitos se siguen encontrando.
5. **Doble motor:** detector nativo del sistema (`BarcodeDetector`) cuando existe (Android Chrome); zxing de respaldo (iOS, Windows, Firefox).
6. **Mejor imagen:** enfoque continuo, resolución alta y —si el dispositivo lo permite— **linterna** y **zoom**.
7. **Guía viva:** el marco cambia de estado (buscando → detectado → confirmado) y muestra una pista corta ("Poné el código dentro del marco").
8. **Sin vibración.** El aviso de "código aceptado" es sólo **sonido** (con el botón de silenciar que ya existe), y suena **al confirmar**, no a la primera lectura.
9. **Prueba automatizada de la cámara:** hoy la ruta de cámara no tiene ningún test; se agrega un e2e con cámara falsa que sirve códigos reales.

**Fuera de alcance:** cambiar el flujo posterior a la lectura (búsqueda, ajuste de stock), OCR, escaneo de varios códigos a la vez, migración masiva de datos existentes.

## Assumptions

1. **Universal = los formatos del punto 3**, no "todos los que existen": más formatos activos = más lecturas falsas (texto del envase leído como Code 39, por ejemplo). Se compensa con la confirmación de 3 lecturas, largo mínimo y validación de dígito verificador.
2. Los códigos que **no** son numéricos (Code 128, Code 39, QR) pueden traer letras y símbolos, así que la validación actual `^\d{8,14}$` (backend y ingreso manual) se **relaja** a: 4–64 caracteres ASCII imprimibles, sin espacios en los extremos. La unicidad sigue garantizada por el índice único de la base (sin migración de esquema).
3. El **dígito verificador** se valida cuando el formato lo define (EAN-13, EAN-8, UPC-A, UPC-E, ITF-14). Code 128 lo trae dentro del propio código y lo verifica el decodificador; Code 39, ITF de otro largo y QR no lo tienen (QR tiene corrección de errores): ahí la garantía es la confirmación de 3 lecturas.
4. Sin dependencias nuevas: `@zxing/browser`/`@zxing/library` ya están; `BarcodeDetector`, `applyConstraints` (linterna, zoom, enfoque) y canvas son APIs del navegador.
5. `BarcodeDetector` no existe en iOS Safari ni en Chrome de Windows: mejora progresiva. Linterna y zoom sólo aparecen si `getCapabilities()` los declara.
6. El ingreso manual se mantiene siempre (es el respaldo y lo usan los e2e).
7. La confirmación de 3 lecturas agrega ~0,3 s de latencia con el ritmo de lectura propuesto (una lectura cada ~100 ms); se acepta a cambio de precisión.

## Tech Stack

- Sin cambios: Next.js 16, React 19, TypeScript, Tailwind 4, `@zxing/browser` + `@zxing/library`.
- APIs web: `BarcodeDetector`, canvas 2D, `getUserMedia` + `applyConstraints`.
- Testing: Vitest (lógica pura), Playwright con la cámara falsa de Chromium.

## Commands

```
Dev:        npm run dev
Unit:       npm test
E2E:        npm run test:e2e
E2E cámara: npx playwright test e2e/scanner.spec.ts
Lint/Build: npm run lint && npm run build
```

## Project Structure

```
src/lib/barcode.ts            → Validación (dígito verificador), normalización a GTIN-13, candidatos de búsqueda
src/lib/scan-geometry.ts      → Marco → rectángulo en píxeles del video (compensa object-cover)
src/lib/scan-confirm.ts       → Confirmación por N lecturas iguales
src/lib/scan-decoder.ts       → Motor de decodificación (BarcodeDetector nativo | zxing) sobre un canvas
src/lib/scanner.ts            → Constantes (marco, umbrales), hints de zxing, errores de cámara (existente)
src/lib/feedback.ts           → Sólo sonido (se quita la vibración)
src/lib/actions/products.ts   → Validación y búsqueda con el código normalizado
src/components/BarcodeScanner.tsx → Visor: marco, estados, linterna, zoom, bucle de lectura
e2e/scanner.spec.ts           → Lectura real con cámara falsa (dentro / fuera del marco / dos códigos)
e2e/fixtures/                 → Video sintético con códigos (generado por script, sin dependencias)
```

## Code Style

Lógica de decisión en funciones puras y chicas, testeables sin cámara; el componente sólo las conecta.

```ts
// src/lib/scan-confirm.ts
export type Confirmer = { push(code: string, now: number): string | null };

/** Acepta un código recién cuando se leyó igual `needed` veces seguidas dentro de `windowMs`. */
export function createConfirmer(needed = 3, windowMs = 1500): Confirmer {
  let last: string | null = null;
  let count = 0;
  let firstAt = 0;
  return {
    push(code, now) {
      if (code !== last || now - firstAt > windowMs) {
        last = code;
        count = 0;
        firstAt = now;
      }
      count += 1;
      return count >= needed ? code : null;
    },
  };
}
```

Convenciones: español en textos, constantes con nombre y comentario del porqué (tamaño del marco, `needed`, intervalo), APIs opcionales siempre detrás de una comprobación (`"BarcodeDetector" in window`, `capabilities.torch`), nunca asumir que existen.

## Testing Strategy

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unit | Confirmación (rechaza lecturas sueltas, acepta 3 iguales, reinicia si cambia el código o vence la ventana); dígito verificador EAN-13/EAN-8/UPC-A/UPC-E/ITF-14 (válidos e inválidos); normalización a GTIN-13 (UPC-A↔EAN-13, UPC-E, 14 dígitos sin tocar) y candidatos de búsqueda; validación relajada (acepta Code 128/39, rechaza vacío/demasiado corto o largo); geometría del marco (mapeo a píxeles con `object-cover` en distintas proporciones) | Vitest |
| E2E cámara | Con la cámara falsa de Chromium sirviendo un video sintético: (1) código **dentro** del marco → se lee y aparece el producto; (2) código **fuera** del marco → **no** se lee; (3) **dos** códigos en cuadro, uno dentro y otro fuera → se lee sólo el de adentro; (4) un Code 128 alfanumérico se lee y da de alta | Playwright + `--use-file-for-fake-video-capture` |
| E2E existentes | Los 23 actuales siguen en verde (incluida la alta manual y el mensaje de validación) | Playwright |
| Manual (Android real) | Precisión con productos reales, linterna, zoom, poca luz, sonido (ver criterios) | Celular |

El e2e usa el motor de zxing (Chromium de escritorio no trae `BarcodeDetector`); el motor nativo sólo se valida a mano en el Android real.

## Boundaries

- **Always:** correr `npm test`, `npm run lint`, `npm run test:e2e` y `npm run build` antes de cada commit; validar el dígito verificador cuando el formato lo define; mantener el ingreso manual; que la falta de una API (detector nativo, linterna, zoom, audio) degrade en silencio, sin errores en pantalla; normalizar el código antes de guardarlo o buscarlo.
- **Ask first:** agregar dependencias; agregar formatos más allá de los 8 definidos; bajar el umbral de confirmación por debajo de 3 lecturas; cambiar el esquema de la base de datos; migrar datos existentes.
- **Never:** aceptar un código con dígito verificador inválido; leer fuera del marco; quitar o debilitar el fallback manual; borrar un e2e para que pase; volver a vibrar; commitear secretos.

## Success Criteria

1. **Marco funcional y tolerante:** con dos códigos en cuadro, se lee sólo el que está dentro del marco (e2e); el marco ocupa ≈ 90 % × 55 % del visor y admite un QR y un código de barras apaisado.
2. **Confirmación:** una lectura o dos no aceptan el código; hacen falta 3 iguales dentro de 1,5 s (unit).
3. **Dígito verificador:** un EAN/UPC/ITF-14 con checksum inválido nunca llega a la búsqueda (unit).
4. **Universalidad:** EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF-14 y QR se aceptan como código de producto de punta a punta (alta manual y lectura), y un Code 128 alfanumérico se da de alta y se vuelve a encontrar.
5. **Normalización:** un producto escaneado como UPC-A (12 dígitos) y luego como EAN-13 (`0` + los 12) es **el mismo producto**, y uno ya guardado con 12 dígitos se sigue encontrando (unit + e2e).
6. **Lectura real automatizada:** en el e2e con cámara falsa, un EAN-13 dentro del marco se lee y muestra el producto en **≤ 3 s**.
7. **Guía viva:** el marco cambia de estado al detectar y al confirmar y la pista está visible; los estados se distinguen sin depender sólo del color.
8. **Sonido, no vibración:** el dispositivo no vibra en ningún caso; suena una vez **al confirmar** (salvo silenciado); sin soporte de audio el escaneo funciona igual.
9. **Degradación:** sin `BarcodeDetector`, sin linterna o sin zoom, la pantalla funciona y no muestra controles rotos ni errores.
10. **Sin regresiones:** los 23 e2e existentes, lint y build en verde; ingreso manual intacto.
11. **Android real (manual):** con 10 productos distintos de góndola a 15–25 cm, **10/10 se leen en ≤ 2 s y 0 se leen mal**; además una etiqueta Code 128 o QR y una caja ITF-14 si hay a mano; linterna y zoom aparecen y funcionan; con poca luz y linterna el código se lee.

## Open Questions

1. **Tocar el backend.** "Universal" obliga a relajar la validación de `createProduct` (hoy sólo 8–14 dígitos) y del ingreso manual. Lo interpreto como parte de tu pedido; te lo marco explícitamente porque es un cambio fuera del componente del escáner. Sin esa relajación, un Code 128 o un QR se leerían pero no se podrían dar de alta.
2. **Productos ya cargados.** Propongo **no migrar** la base: el código canónico aplica a los productos nuevos y la búsqueda prueba también la variante de 12/13 dígitos, así los existentes se siguen encontrando. Si preferís normalizar los existentes, es una tarea aparte con un script de migración (y ahí sí conviene avisarte antes de tocar datos).
