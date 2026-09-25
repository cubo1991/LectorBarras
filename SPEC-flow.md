# Spec: LectorBarras — Flujo de escaneo continuo y ajuste de stock

Complementa a `SPEC.md`, `SPEC-front.md` y `SPEC-scanner.md`. Nace de la revisión UX de Caro (`.claude/agency/artifacts/scanner-ux/ux-spec.md`), que David aprobó **completa**, y de sus respuestas de uso.

## Objective

**Qué dijo David sobre el uso real**
- Se usa como **consulta puntual**, pero también se **escanea todo seguido** (varios productos en fila).
- **Al recibir mercadería, el stock se suma por unidad**: cada unidad que se escanea suma 1.

**Problema hoy (verificado en el código):** tras cada escaneo la cámara se apaga para mostrar la ficha; para el siguiente hay que tocar "Escanear otro código" y esperar que la cámara arranque. Sólo hay `-1`/`+1`, no hay forma de deshacer un toque de más, el ajuste no confirma nada, y si la lectura tarda no hay ayuda contextual.

**Objetivo:** que consultar un producto sea instantáneo, que escanear muchos seguidos no cueste nada, y que recibir mercadería sea "escaneo cada unidad y listo" — con la certeza de no cambiar el stock por accidente.

**Qué se construye**
1. **Cámara siempre viva:** la ficha aparece **debajo** del visor sin apagarlo; escanear otro producto reemplaza la ficha.
2. **Dos comportamientos con un interruptor "Sumar al escanear":**
   - **Consulta (por defecto):** al escanear un producto conocido se muestra su ficha; el stock **no** cambia.
   - **Suma:** cada lectura confirmada de un producto conocido suma **+1 automáticamente** (recepción de mercadería) y avisa con un aviso "+1 · Deshacer".
3. **Regla anti-duplicado:** el mismo código no cuenta dos veces mientras sigue a la vista; vuelve a contar sólo cuando **sale del marco** (≥ 700 ms sin leerse) o cuando se confirma **otro** código.
4. **Cantidades:** `-1 · +1 · +5 · +10` y **"Otra cantidad"** (teclado numérico, sumar o restar).
5. **Deshacer:** tras cualquier ajuste, un aviso de 6 s con "Deshacer" que aplica el movimiento inverso (queda registrado; **no** se borra historial).
6. **Confirmación visible del ajuste:** el número se resalta un instante y se anuncia ("Stock actualizado a 13").
7. **Ayuda contextual:** si no hay lecturas válidas, la pista cambia a los ~8 s y sugiere el ingreso manual a los ~20 s.
8. **Interruptores** (`role="switch"`) para Sonido, Linterna y Sumar al escanear, con etiqueta fija.
9. **Escanear como pantalla de inicio:** tras el login se entra directo a `/scan`; "Inicio" desaparece de la navegación (queda Escanear · Productos) y `/` redirige a `/scan`.
10. **Ingreso manual con teclado numérico por defecto** y un botón "ABC" para pasar a texto (los alfanuméricos siguen soportados).
11. **Pulido:** "Mostrar contraseña" en login/registro; link a `/login` en el aviso de sesión vencida; textos nuevos (ver tabla de copy).
12. **Integridad del stock (hallazgo de esta revisión):** `adjustStock` lee el stock y después lo escribe dentro de la transacción; dos ajustes simultáneos pueden **pisarse** (dos `+1` sobre 5 terminan en 6, no en 7). Con suma automática y varios usuarios es un riesgo real: el ajuste pasa a ser **atómico** (`stock = stock + delta` con la condición de no quedar negativo en la misma sentencia).

**Fuera de alcance:** historial visible de movimientos, filtros u orden en `/products`, reportes, cambios de esquema de base de datos, el motor de lectura (ya cerrado en `SPEC-scanner.md`).

## Assumptions

1. **Verificado en el código:** `adjustStock` acepta cualquier entero distinto de 0 (no está limitado a ±1), así que cantidades y deshacer **no requieren cambio de esquema** ni de contrato; deshacer es otro `adjustStock` con `-delta`.
2. **Decisiones que tomé por David (que objete lo que no le cierre):**
   - El interruptor **Sumar al escanear no se recuerda**: cada visita a `/scan` arranca en **Consulta**. Motivo: un estado "sumo solo" olvidado cambiaría stock al sólo consultar. Mientras está activo se ve un aviso fijo ("Modo suma: cada lectura suma +1").
   - **Tope de 9999 unidades por ajuste** (validado en el servidor) para frenar el error de tipeo ("2400" por "24").
   - **Aviso de deshacer: 6 s**; pausa mientras el foco esté en él.
   - **Ayuda contextual: 8 s y 20 s** (números de partida; se afinan con lo que David vea en el Android real).
3. En modo Suma, un producto **desconocido** no suma nada: se ofrece "Cargar producto" (con su stock inicial); después la cámara sigue viva.
4. Mientras una búsqueda está en curso se ignoran las confirmaciones nuevas (ya existe esa guarda en `/scan`).
5. Los componentes existentes (`Button`, `Field`, `Alert`, `Card`, `Badge`, tokens claro/oscuro) se reutilizan; sólo se agregan `Switch` y el aviso de deshacer.

## Tech Stack

Sin cambios ni dependencias nuevas: Next.js 16, React 19, TypeScript, Tailwind 4, Drizzle + Postgres, Zod, Vitest, Playwright (+ axe ya instalado).

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
src/lib/scan-rearm.ts          → Regla anti-duplicado (puro): cuándo un código vuelve a poder contar
src/lib/actions/stock.ts       → adjustStock atómico + tope de cantidad
src/lib/scan-help.ts           → Pista según tiempo sin lecturas y capacidades (puro)
src/components/ui/Switch.tsx   → Interruptor accesible
src/components/ui/Toast.tsx    → Aviso con acción (Deshacer), con aria-live
src/components/BarcodeScanner.tsx → Visor persistente + pista contextual
src/components/ProductPanel.tsx   → Ficha bajo el visor: stock, cantidades, "Otra cantidad", deshacer
src/app/(app)/scan/page.tsx    → Orquesta: visor + ficha + modo Consulta/Suma
src/app/(app)/layout.tsx, page.tsx → Escanear como inicio, nav sin "Inicio"
e2e/                           → Specs nuevos y actualizados (ver Testing)
```

## Code Style

Lógica de decisión en funciones puras testeadas sin cámara; los componentes sólo las conectan. Ejemplo de la regla anti-duplicado:

```ts
// src/lib/scan-rearm.ts
/** Un código ya contado sólo vuelve a contar cuando salió del marco o llegó otro distinto. */
export function createRearm(absentMs: number) {
  let counted: string | null = null;
  let lastSeenAt = 0;
  return {
    /** ¿Esta lectura confirmada debe contarse? */
    shouldCount(code: string, now: number): boolean {
      const sameStillInView = code === counted && now - lastSeenAt < absentMs;
      lastSeenAt = now;
      if (sameStillInView) return false;
      counted = code;
      return true;
    },
    /** Llamar en cada lectura (aunque no se confirme) para saber que el código sigue a la vista. */
    seen(code: string, now: number) {
      if (code === counted) lastSeenAt = now;
    },
  };
}
```

Convenciones: español en textos, constantes con nombre y el porqué, APIs opcionales tras comprobación, objetivos táctiles ≥ 44 px, nada que dependa sólo del color.

## Testing Strategy

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unit | Regla anti-duplicado (mismo código a la vista no cuenta; sale y vuelve cuenta; otro código cuenta); pista contextual por tiempo/capacidades; `adjustStock` (tope, cero, negativo) | Vitest |
| Integración (DB real) | **20 ajustes `+1` concurrentes terminan en +20** (el bug de pisado); restar bajo cero se rechaza sin cambiar nada | Script/test contra la base de desarrollo |
| E2E cámara falsa | Cámara **no se reinicia** al mostrar la ficha; modo Consulta no cambia el stock; modo Suma suma **una vez** con el código fijo a la vista y **otra vez** cuando sale y vuelve (video "pulso": código 2 s / vacío 2 s); desconocido en modo Suma ofrece cargar | Playwright + y4m |
| E2E flujo | Cantidades (+5, +10, "Otra cantidad"), deshacer (stock vuelve y quedan 2 movimientos), login → aterriza en `/scan`, `/` redirige | Playwright |
| E2E accesibilidad/responsive | axe claro y oscuro y 360 px en el visor + ficha + aviso; los interruptores como `switch`; foco visible | Playwright + axe |
| Existentes | Los 39 actuales siguen en verde (se actualizan sólo los que dependen de "Inicio" o de "Escanear otro código") | Playwright |
| Manual (Android real) | Recepción de una tanda de 10 productos de a unidad; deshacer con el pulgar; ayuda contextual | Celular |

## Boundaries

- **Always:** correr `test`, `lint`, `build` y `test:e2e` antes de cada commit/push; mostrar de forma inequívoca cuando el modo Suma está activo; registrar todo cambio de stock como movimiento (incluido el deshacer).
- **Ask first:** dependencias nuevas; cambios de esquema de base de datos; cualquier otra ruta que se mueva o elimine además de `/` → `/scan`; ampliar o quitar el tope de 9999.
- **Never:** que el stock cambie sin un aviso visible y deshacible; borrar o editar movimientos existentes; recordar el modo Suma entre visitas; quitar el ingreso manual; borrar un e2e para que pase.

## Success Criteria

1. **Cámara viva:** tras un escaneo la cámara **no** se reinicia (el visor no vuelve a "Iniciando cámara…") y la ficha aparece bajo el visor.
2. **Consulta segura:** en modo Consulta escanear no cambia el stock (e2e verifica el stock antes y después).
3. **Recepción por unidad:** en modo Suma, un producto conocido **suma exactamente +1** por unidad escaneada; con el mismo código fijo a la vista durante 4 s suma **una vez**; al sacarlo y volver a mostrarlo suma **otra**.
4. **Costo por producto en una tanda:** de ~2 toques + 2 esperas + reinicio de cámara a **0 toques en modo Suma** y **1 toque (`+1`) en modo Consulta**, sin reinicios.
5. **Cantidades:** `+5`, `+10` y "Otra cantidad" ajustan el stock correctamente; 0, negativos y > 9999 se rechazan con un mensaje claro.
6. **Deshacer:** tras un ajuste, "Deshacer" restaura el stock anterior y **quedan dos movimientos** registrados (el ajuste y su inverso).
7. **Integridad:** 20 ajustes concurrentes sobre el mismo producto dan el resultado exacto; nunca queda stock negativo.
8. **Feedback:** el ajuste resalta el número y se anuncia por `aria-live`.
9. **Ayuda contextual:** sin lecturas a los ~8 s la pista cambia; a los ~20 s sugiere el ingreso manual (unit + e2e).
10. **Interruptores y modo:** Sonido, Linterna y Sumar al escanear son `switch` con etiqueta fija; el modo Suma muestra un aviso permanente y **no** se recuerda al volver a `/scan`.
11. **Inicio:** tras el login se cae en `/scan`; `/` redirige; la navegación queda en Escanear · Productos.
12. **Pulido:** "Mostrar contraseña" funciona con teclado y lector de pantalla; el aviso de sesión vencida enlaza a `/login`; el ingreso manual abre teclado numérico y "ABC" lo cambia.
13. **Sin regresiones:** lint, build, unit y e2e en verde; axe sin violaciones en claro y oscuro; sin scroll horizontal a 360 px.
14. **Android real (manual):** recepción de 10 productos de a unidad sin tocar la pantalla más que para deshacer; el aviso de deshacer se alcanza con el pulgar.

## Copy (tabla)

| Dónde | Hoy | Nuevo |
|---|---|---|
| Producto no cargado | "No existe un producto con el código X." | "El código X todavía no está cargado." |
| Botón de alta | "Dar de alta" | "Cargar producto" |
| Volver a escanear | "Escanear otro código" | (desaparece: la cámara sigue viva) |
| Sonido / Linterna | "Sonido: activado" / "Linterna: apagada" | Interruptor "Sonido" / "Linterna" |
| Modo suma | — | Interruptor "Sumar al escanear"; aviso fijo "Modo suma: cada lectura suma +1" |
| Aviso tras ajustar | — | "Leche entera: 12 → 13 · Deshacer" |
| Sesión vencida | "…Volvé a iniciar sesión e intentá de nuevo." | "No pudimos buscar el producto. Volver a iniciar sesión" (con link) |

> Los e2e existentes dependen de algunos de estos textos ("No existe un producto…", "Dar de alta", "Escanear otro código"). Se actualizan a la vez que se cambia el texto, tarea por tarea.

## Open Questions

Ninguna bloqueante: las decisiones de la sección Assumptions (modo Suma no persistente, tope 9999, 6 s de deshacer, 8/20 s de ayuda) son valores de partida; David las puede cambiar sin rehacer nada.
