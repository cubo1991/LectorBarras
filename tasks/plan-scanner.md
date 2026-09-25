# Implementation Plan: LectorBarras — Precisión del escáner

Spec: `SPEC-scanner.md`. Tareas: `tasks/todo-scanner.md`. Plan aparte de `tasks/plan.md` (backend) y `tasks/plan-front.md` (front, ya cerrado salvo tus revisiones manuales).

## Overview

Convertir el escáner en un lector preciso y universal: sólo lee lo que está dentro del marco, acepta un código recién tras 3 lecturas iguales, entiende los formatos de un comercio chico (EAN/UPC, Code 128/39, ITF-14, QR), normaliza el código para que el mismo producto no se duplique, usa el detector nativo en Android, y avisa con sonido (sin vibración). Se construye **de adentro hacia afuera**: primero la lógica pura y el backend (deterministas, fáciles de testear), después la infraestructura de cámara falsa para poder probar la lectura de verdad, y recién ahí el bucle de lectura y la interfaz.

## Dependency graph

```
T1 barcode.ts (validación, normalización, candidatos)          ← lógica pura
 ├── T2 backend + ingreso manual universales (+ e2e manual)
 └── T6 lectura: confirmación + formatos + checksum + normalización
T3 cámara falsa: generador de video + config Playwright + e2e base   ← riesgo alto, temprano
 └── T5 marco funcional: bucle propio sobre canvas (ROI) + e2e dentro/fuera/dos
T4 scan-confirm + scan-geometry (lógica pura)
 ├── T5 (usa geometry)
 └── T6 (usa confirm)
T5 ── T6 ── T7 motor nativo (BarcodeDetector)
       └── T8 cámara: enfoque, linterna, zoom
       └── T9 guía viva + sonido al confirmar (sin vibración)
```

## Architecture Decisions

- **Bucle de lectura propio en vez de `decodeFromConstraints`.** zxing sólo decodifica el cuadro completo y cada 500 ms. Para leer sólo el marco hay que dibujar la región en un canvas y decodificarlo (`decodeFromCanvas`) cada ~100 ms. Es lo que hace funcional al marco y permite 3 lecturas en ~0,3 s.
- **Decodificador con interfaz única** (`canvas → {text, format} | null`): dos implementaciones (BarcodeDetector nativo, zxing). El componente no sabe cuál usa; el e2e ejercita zxing y el motor nativo se prueba con un `BarcodeDetector` simulado en unit y a mano en Android.
- **La geometría del marco se calcula, no se supone.** El video se muestra con `object-cover`, así que la zona visible no es el cuadro completo. `scan-geometry.ts` mapea el marco (en %) del contenedor a píxeles del video; se prueba con varias proporciones. Es la fuente de error más probable del "marco funcional".
- **`barcode.ts` es la única fuente de verdad** de validación y normalización, compartida por el escáner, el ingreso manual y el backend (`createProduct`, `lookupProductByBarcode`). El dígito verificador se exige a las **lecturas de cámara** de formatos GS1 (se conoce el formato); el **ingreso manual es tolerante** (4–64 ASCII imprimibles), porque un comercio puede usar códigos numéricos internos sin GTIN válido.
- **Normalización a GTIN-13** para EAN-13/UPC-A/UPC-E; EAN-8, ITF-14 y los alfanuméricos quedan tal cual. La búsqueda prueba el canónico **y** la variante de 12 dígitos (productos viejos). Sin migración ni cambio de esquema.
- **Cámara falsa de Chromium** (`--use-file-for-fake-video-capture` con y4m generado por un script propio a partir del `MultiFormatWriter` de `@zxing/library`): sin dependencias nuevas y sin commitear binarios (los videos se generan en `globalSetup` en una carpeta ignorada por git).
- **Lo que no se puede automatizar se declara**: motor nativo, linterna, zoom y sonido real sólo se validan a mano en el Android (criterio 11 de la spec).

## Task List

### Phase 1: Lógica y backend universales
- [ ] Task 1: `barcode.ts` — validación, normalización y candidatos de búsqueda
- [ ] Task 2: Backend e ingreso manual universales

### Checkpoint: Códigos
- [ ] `npm test`, `lint`, `build`, `test:e2e` en verde
- [ ] Un Code 128 alfanumérico se da de alta a mano y se encuentra; UPC-A y EAN-13 equivalentes son el mismo producto

### Phase 2: Infraestructura de cámara y marco funcional
- [ ] Task 3: Cámara falsa para e2e (generador de video + config + prueba base)
- [ ] Task 4: `scan-confirm.ts` y `scan-geometry.ts` (lógica pura)
- [ ] Task 5: Marco funcional — bucle de lectura sobre canvas (ROI)

### Checkpoint: Marco
- [ ] e2e: código dentro del marco se lee; fuera no; con dos códigos sólo el de adentro

### Phase 3: Precisión y formatos
- [ ] Task 6: Confirmación de 3 lecturas, formatos universales y normalización en la lectura
- [ ] Task 7: Detector nativo (`BarcodeDetector`) con respaldo zxing

### Phase 4: Imagen y guía
- [ ] Task 8: Cámara — enfoque continuo, linterna y zoom
- [ ] Task 9: Guía viva y sonido al confirmar (sin vibración)

### Checkpoint: Completo
- [ ] Criterios 1–10 de `SPEC-scanner.md` cumplidos y automatizados
- [ ] Criterio 11 probado en el Android real (10 productos, ITF-14/Code 128/QR si hay, linterna, zoom, poca luz)
- [ ] `lint`, `test`, `test:e2e`, `build` en verde y deploy verificado

## Parallelization

- T1 y T3 son independientes (uno es lógica pura, el otro infraestructura): pueden hacerse en cualquier orden. Se hace **T3 temprano** para descubrir cuanto antes si la cámara falsa funciona en este entorno.
- T4 sólo necesita nada previo; T5 necesita T3 y T4; T6 necesita T1, T4 y T5; T7, T8 y T9 son independientes entre sí una vez hecha T6.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| La cámara falsa de Chromium no funciona en este entorno (Windows, headless, formato y4m) | Alto | **Task 3 antes que nada del bucle**: se prueba con el escáner actual. Si falla, plan B: inyectar un `getUserMedia` que devuelva un `canvas.captureStream()` con el código dibujado (`page.addInitScript`) |
| El mapeo marco → píxeles del video falla con `object-cover` y el marco lee una zona distinta de la que se ve | Alto | `scan-geometry.ts` con tests en varias proporciones y un e2e "fuera del marco no se lee" que lo delata |
| Más formatos → lecturas falsas (texto del envase leído como Code 39) | Medio | 3 lecturas iguales, largo mínimo 4, checksum en GS1; el e2e "dos códigos" verifica que no se lee lo de afuera |
| `TRY_HARDER` + 8 formatos hace lenta cada decodificación y no se llega a 3 lecturas en 1,5 s | Medio | Decodificar sólo el marco (menos píxeles), intervalo adaptativo (no encolar lecturas), medir en el e2e; bajar formatos por defecto si hace falta |
| Relajar la validación de `createProduct` permite basura como código | Medio | 4–64 ASCII imprimibles, sin espacios en los extremos; el ingreso de cámara pasa por el filtro estricto por formato |
| Productos ya guardados con 12 dígitos no se encuentran tras normalizar | Medio | `lookupProductByBarcode` busca con candidatos (canónico + variante 12); test e2e con un producto de 12 dígitos |
| Motor nativo se comporta distinto que zxing (p. ej. UPC-A como 12 vs 13 dígitos) | Medio | Todo pasa por `normalize()`; unit con un detector simulado; verificación manual en Android |
| Cada push a `master` despliega a producción (aceptado) | Bajo | Push sólo con la suite completa en verde |

## Open Questions

Ninguna abierta: las decisiones (formatos universales, marco tolerante ≈ 90 % × 55 %, 3 lecturas, sin vibración, backend relajado, sin migración) están aprobadas.
