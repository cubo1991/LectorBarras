# Spec: LectorBarras — Front

Complementa a `SPEC.md` (que define el producto y el backend). Este documento cubre **sólo la capa visual y de interacción**. No cambia el modelo de datos, las server actions ni la lógica de auth.

## Objective

Hoy la app funciona pero se ve a medio hacer: `/` es todavía el template de create-next-app, el `<title>` dice "Create Next App", `<html lang="en">`, el `body` fuerza Arial pisando Geist, las pantallas usan clases sueltas (`border p-2`, `bg-black`) sin sistema común, los inputs de login/registro no tienen `<label>` (sólo placeholder) y no hay navegación entre pantallas.

**Qué construimos:** un sistema visual común y aplicarlo a todas las pantallas existentes, con una home real y un shell de navegación.

**Usuario:** equipo interno que usa la app **desde el celular, parado frente a la góndola/depósito, con una mano**. La notebook es secundaria.

**Dirección visual:** utilitaria, limpia, de alto contraste. Herramienta de trabajo: legible con mala luz, estados claros (éxito, error, stock bajo/cero), sin adornos ni identidad de marca.

**En alcance**
1. Sistema de diseño: tokens (color, tipografía, espaciado, radios) y componentes base compartidos.
2. Shell de navegación (encabezado + acceso a Escanear / Productos / Salir) y **home real** en `/`.
3. Rediseño de `/login`, `/register`, `/scan`, `/products` y sus estados (vacío, cargando, error, éxito).
4. **Modo oscuro real**, consistente en todas las pantallas.
5. **Feedback al escanear**: sonido al confirmar un código, con opción de silenciar. *(Actualizado: la vibración se descartó; ver `SPEC-scanner.md`.)*
6. **Accesibilidad WCAG 2.1 AA**, verificada automáticamente en e2e.
7. **Instalable como PWA** (ícono en pantalla de inicio, arranque standalone).

**Fuera de alcance:** pantallas nuevas de negocio (historial de movimientos, detalle/edición/baja de producto, panel de estadísticas), soporte offline, notificaciones push, cambios de backend.

## Assumptions

1. Se mantiene Tailwind 4 con Server Components por default y `"use client"` sólo donde hay interactividad.
2. El idioma de la interfaz es español rioplatense (los textos actuales ya lo están); `lang="es"`.
3. Los formularios de login/registro **siguen siendo server actions con `<form action>`** (envío por POST sin depender de la hidratación). Es una corrección de seguridad de Task 3 y no se toca.
4. "Instalable" = manifest + íconos + `display: standalone`. **Sin service worker** (no hay requisito offline), así que no se agrega ninguna dependencia. Next lo soporta nativo con `app/manifest.ts`.
5. Las rutas y URLs actuales no cambian (`/scan`, `/products`, `/login`, `/register`, `/scan?code=`), porque los e2e y los links dependen de ellas.
6. La vibración (`navigator.vibrate`) no existe en iOS Safari; el sonido (Web Audio) requiere un gesto previo del usuario para desbloquearse. Ambos son mejoras progresivas: si no hay soporte, el flujo funciona igual.

## Tech Stack

- Next.js 16.3 (App Router), React 19.2, TypeScript estricto, Tailwind CSS 4 (`@theme` en `globals.css`).
- Tipografía: Geist ya instalada vía `next/font` (se deja de pisar con Arial).
- Sin librería de componentes ni de íconos: componentes propios livianos + SVG inline.
- Testing: Vitest (lógica), Playwright (e2e responsive + accesibilidad).

## Commands

```
Dev:        npm run dev
Build:      npm run build
Lint:       npm run lint
Unit:       npm test
E2E:        npm run test:e2e
E2E mobile: npx playwright test --project=mobile
```

(`--project=mobile` es un proyecto nuevo de Playwright con viewport 360×740 y touch; se define en la Task de tests responsive.)

## Project Structure

```
src/app/globals.css          → Tokens de diseño (@theme), modo claro/oscuro, base
src/app/layout.tsx           → <html lang="es">, fuente, metadata, viewport/theme-color
src/app/manifest.ts          → Web App Manifest (PWA)
src/app/(app)/layout.tsx     → Shell autenticado: encabezado + navegación
src/app/(app)/page.tsx       → Home real (`/`)
src/app/(app)/scan|products  → Pantallas existentes (se mueven al grupo sin cambiar URL)
src/app/(auth)/              → /login, /register (sin shell)
src/components/ui/           → Button, Field (label+input+error), Alert, Card, Badge
src/components/              → BarcodeScanner, NewProductForm, LogoutButton (existentes, se restilizan)
src/lib/feedback.ts          → Vibración/sonido al escanear + preferencia de silencio
public/icons/                → Íconos PWA (192, 512, maskable)
e2e/                         → Specs existentes + responsive.spec.ts + a11y.spec.ts
```

El grupo de rutas `(app)` no altera las URLs; sólo permite un layout con shell distinto al de `(auth)`.

## Code Style

Componentes chicos, props tipadas, estilos con tokens (nunca colores hexadecimales sueltos en JSX) y estados de foco visibles.

```tsx
// src/components/ui/Field.tsx
type FieldProps = React.ComponentProps<"input"> & { label: string; error?: string };

export function Field({ label, error, id, ...props }: FieldProps) {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className="min-h-11 rounded-md border border-border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-accent"
        {...props}
      />
      {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
```

Convenciones: objetivos táctiles ≥ 44 px (`min-h-11`), el color nunca es la única señal (los estados llevan texto o ícono), texto en español, sin `outline-none` sin reemplazo.

## Testing Strategy

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unit | `feedback.ts` (respeta preferencia de silencio, no rompe sin `navigator.vibrate`/`AudioContext`) | Vitest |
| E2E responsive | Cada pantalla a 360 px: sin scroll horizontal, botones ≥ 44 px, navegación alcanzable | Playwright (proyecto `mobile`) |
| E2E accesibilidad | Cada pantalla en claro y oscuro sin violaciones AA (contraste, labels, roles, nombre accesible) | Playwright + `@axe-core/playwright` |
| E2E existentes | Los 15 actuales siguen en verde (regresión del flujo) | Playwright |
| Manual | Instalar en el celular, escanear con feedback, modo oscuro con luz baja | Celular real |

Los tests visuales (screenshots) quedan fuera: su mantenimiento no compensa para una app interna.

## Boundaries

- **Always:** correr `npm test`, `npm run lint` y `npm run test:e2e` antes de cada commit; mantener los formularios de auth como server actions; usar tokens en vez de colores sueltos; una tarea a la vez con verificación.
- **Ask first:** agregar cualquier dependencia (incluida `@axe-core/playwright`, una librería de íconos o de componentes); cambiar rutas o URLs; agregar un service worker; agregar logo o assets de marca; mostrar datos nuevos en la home que requieran una consulta nueva.
- **Never:** tocar server actions, esquema de DB o lógica de Auth.js; volver a formularios que dependan de hidratación para enviarse por POST; borrar o debilitar un e2e para que pase; dejar `outline: none` sin foco alternativo; commitear secretos.

## Success Criteria

1. `/` muestra una home funcional (sin rastro del template de Next); `<title>` y `<html lang>` correctos en todas las páginas.
2. Un usuario logueado llega a Escanear, Productos y Salir desde cualquier pantalla en **un toque**, sin usar el botón "atrás".
3. En 360×740 ninguna pantalla tiene scroll horizontal y todo control interactivo mide ≥ 44×44 px.
4. Axe no reporta violaciones WCAG 2.1 AA en `/login`, `/register`, `/`, `/scan`, `/products` en modo claro **y** oscuro. Todo input tiene `<label>` asociado.
5. El modo oscuro sigue `prefers-color-scheme` y ninguna pantalla queda con texto ilegible o fondos claros residuales.
6. Al confirmar un código suena un aviso (no vibra); existe un control visible para silenciar y la preferencia persiste. Sin soporte de audio, el escaneo funciona igual. *(Ver `SPEC-scanner.md`.)*
7. La app pasa el chequeo de instalabilidad de Chrome (manifest válido, íconos 192/512 + maskable) y abre en modo standalone tras "Agregar a inicio" en un celular real.
8. Los 15 e2e existentes siguen en verde; `npm run build` y `npm run lint` sin errores.
9. Verificado manualmente en un celular real: flujo escanear → ajustar stock con la app instalada.

## Open Questions

1. **Contenido de la home.** Propuesta por defecto: un lanzador con dos acciones grandes (Escanear / Buscar productos) y el saludo con el email. ¿Querés además mostrar datos (total de productos, últimos movimientos)? Eso requiere una consulta nueva → "Ask first".
2. **Paleta de acento.** Utilitario y alto contraste; propuesta: neutros + un único acento (azul) y semánticos verde/ámbar/rojo para éxito/stock bajo/error. ¿Tenés un color preferido?
3. **Umbral de "stock bajo".** Si el listado muestra un estado de stock bajo, ¿desde cuántas unidades? (hoy no existe el concepto en el modelo; propuesta: sólo distinguir "sin stock" = 0, sin umbral configurable).
4. **Sonido en iOS.** Requiere desbloqueo por gesto: propongo desbloquear el audio con el primer toque del usuario en `/scan`. Si no alcanza, iOS queda sin sonido (sólo visual).
5. **Nombre e íconos de la app instalada.** Propongo "LectorBarras" como nombre y un ícono simple generado (SVG → PNG), ya que no hay identidad de marca. ¿Está bien?
