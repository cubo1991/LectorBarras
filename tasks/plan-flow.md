# Implementation Plan: LectorBarras — Flujo de escaneo continuo

Spec: `SPEC-flow.md` (aprobada). Tareas: `tasks/todo-flow.md`. UX de origen: `.claude/agency/artifacts/scanner-ux/ux-spec.md`.
Planes anteriores (`plan.md`, `plan-front.md`, `plan-scanner.md`) están cerrados salvo sus verificaciones manuales en el Android; este es aparte.

## Overview

Pasar de "escanear → ficha → apretar 'Escanear otro' → esperar la cámara" a una pantalla donde **la cámara nunca se apaga**: consulta puntual por defecto, y un modo "Sumar al escanear" que suma +1 por unidad al recibir mercadería, con deshacer, cantidades, ayuda contextual y escaneo como pantalla de inicio. Se construye de abajo hacia arriba: primero la **integridad del stock** y las reglas puras, después la pantalla persistente (donde está el riesgo), después lo que se apoya en ella.

## Dependency graph

```
T1 stock atómico + tope + test de concurrencia        ← independiente, integridad de datos
T2 reglas puras: anti-duplicado (scan-rearm) y ayuda (scan-help)
 ├── T3 cámara viva + ficha bajo el visor + fixture "pulso"   ← el riesgo grande
 │     ├── T4 cantidades + "Otra cantidad" + feedback del ajuste
 │     │     └── T5 deshacer (toast)
 │     ├── T6 interruptores accesibles (Sonido, Linterna)
 │     │     └── T7 modo "Sumar al escanear"   (necesita T5 y T6)
 │     └── T8 ayuda contextual (necesita T2 y T3)
 ├── T9  Mostrar contraseña + link de sesión vencida       ← independiente de lo anterior
 ├── T10 copy nuevo + teclado numérico/ABC                 ← toca BarcodeScanner: después de T8
 └── T11 Escanear como inicio                              ← al final: cambia URLs que usan los e2e
```

## Architecture Decisions

- **La regla anti-duplicado vive en `BarcodeScanner`**, no en la página: el visor le entrega a la página **un evento por presentación** del código (no uno cada 0,3 s). Sin eso, con la cámara viva y la ficha visible, el mismo código dispararía búsquedas sin fin. Es la misma regla para Consulta y para Suma.
- **Deshacer = otro `adjustStock` con `-delta`.** No hay cambio de esquema ni de contrato, y el historial queda íntegro (el SPEC exige que todo cambio de stock se registre). Si el inverso dejaría stock negativo porque otra persona movió el producto entretanto, se informa y no se aplica.
- **`adjustStock` atómico:** `UPDATE products SET stock = stock + $delta WHERE id = $id AND stock + $delta >= 0 RETURNING …` + insert del movimiento en la misma transacción. Hoy hace leer-y-después-escribir y dos ajustes simultáneos se pisan.
- **Test de concurrencia contra la base real** en un proyecto de Vitest aparte (`test:db`, `*.db.test.ts`), porque el bug sólo se ve con una base de verdad y no debe correr con el `npm test` diario (usa la base de desarrollo y datos etiquetados).
- **Fixture de video "pulso"** (código 2 s / vacío 2 s, a 5 fps para no pesar de más) para probar de punta a punta que el mismo código no cuenta dos veces mientras está a la vista y sí cuenta al volver. Se valida **temprano** (T3) contando los POST de búsqueda, no recién en el modo Suma.
- **El modo Suma no se persiste** y tiene un aviso fijo: es una decisión de seguridad de datos (un estado "sumo solo" olvidado cambiaría stock sin querer).
- **Sin dependencias nuevas.** `Switch` y `Toast` son componentes propios sobre los tokens existentes.
- **Trabajo directo en `master`**, un commit y push por tarea con `test`, `lint`, `build` y `test:e2e` en verde.

## Task List

### Phase 1: Integridad y reglas
- [ ] Task 1: `adjustStock` atómico, tope de cantidad y test de concurrencia
- [ ] Task 2: Reglas puras — anti-duplicado y ayuda contextual

### Checkpoint: Reglas
- [ ] `test`, `lint`, `build`, `test:e2e` y `test:db` en verde

### Phase 2: La pantalla persistente
- [ ] Task 3: Cámara viva + ficha bajo el visor + fixture "pulso"
- [ ] Task 4: Cantidades, "Otra cantidad" y confirmación visible del ajuste
- [ ] Task 5: Deshacer

### Checkpoint: Consulta
- [ ] La cámara no se reinicia; el mismo código no dispara búsquedas repetidas; ajustar y deshacer funcionan
- [ ] Revisión con el usuario

### Phase 3: Modo recepción y ayuda
- [ ] Task 6: Interruptores accesibles (Sonido, Linterna)
- [ ] Task 7: Modo "Sumar al escanear"
- [ ] Task 8: Ayuda contextual

### Checkpoint: Recepción
- [ ] Recibir una tanda de unidades suma exacto, una vez por unidad, con deshacer
- [ ] Revisión con el usuario

### Phase 4: Pulido y estructura
- [ ] Task 9: "Mostrar contraseña" y link de sesión vencida
- [ ] Task 10: Copy nuevo y teclado numérico con "ABC"
- [ ] Task 11: Escanear como pantalla de inicio

### Checkpoint: Completo
- [ ] Criterios 1–13 de `SPEC-flow.md` cumplidos y automatizados
- [ ] Criterio 14 probado en el Android real (recepción de 10 productos de a unidad)
- [ ] `lint`, `test`, `test:db`, `test:e2e`, `build` en verde; deploy verificado

## Parallelization

- T1 y T2 son independientes entre sí y del resto: cualquier orden.
- T9 no depende de nada del escáner: puede hacerse en cualquier momento.
- Secuenciales por archivo compartido: T3 → T4 → T5 y T6 → T7 → T8 → T10 (todos tocan `BarcodeScanner.tsx` o la página de escaneo).
- T11 va última porque cambia la URL de aterrizaje que usan casi todos los e2e.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Con la cámara viva, el mismo código a la vista dispara búsquedas o sumas sin parar | Alto | Regla anti-duplicado en el visor (T2) verificada de punta a punta en T3 con el fixture "pulso": 4 s con el código fijo = **1** búsqueda; sacarlo y volver = **2** |
| Sumar por accidente en modo Consulta o con el modo Suma olvidado | Alto | Consulta por defecto, modo no persistente, aviso fijo, deshacer de 6 s, e2e que verifica el stock sin cambios en Consulta |
| Pérdida de ajustes por concurrencia (varios usuarios, suma automática) | Alto | T1: ajuste atómico y test contra la base real con 20 ajustes concurrentes |
| Cambiar textos y URLs rompe los e2e (23 referencias a textos que cambian; "/" como aterrizaje) | Medio | Cada tarea que cambia un texto actualiza los e2e en el mismo commit; T11 (URLs) al final |
| El fixture "pulso" pesa demasiado o los 5 fps hacen lenta la lectura | Medio | Video chico y de pocos cuadros, generado en cada corrida y fuera de git; se mide en T3. Plan B: subir la resolución sólo del cuadro con código |
| Deshacer falla porque otra persona movió el stock entretanto | Medio | Si el inverso dejaría stock negativo se informa "el stock cambió, no se puede deshacer" y no se aplica |
| El aviso de deshacer tapa la ficha o es inalcanzable con el pulgar | Medio | Posición fija abajo, sobre la barra de navegación; axe + chequeo de 44 px con el aviso visible |
| Cada push a `master` despliega a producción (aceptado) | Bajo | Push sólo con la suite completa en verde |

## Open Questions

Ninguna bloqueante. Valores de partida a afinar con el Android real: 700 ms de "sale del marco", 6 s de deshacer, 8 s / 20 s de ayuda contextual.
