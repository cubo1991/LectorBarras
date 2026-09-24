# Implementation Plan: LectorBarras

## Overview

App Next.js de inventario: login → escanear código de barras con la cámara → ver/ajustar stock del producto (o darlo de alta si no existe) → buscar productos sin escanear. Se construye en slices verticales: primero la base (proyecto + DB), después auth, después el flujo de escaneo completo de punta a punta, y al final búsqueda + pulido.

## Architecture Decisions

- **Neon driver (`@neondatabase/serverless` + `drizzle-orm/neon-http`)** en vez del driver `pg` estándar: Vercel Postgres/Neon es serverless, el driver HTTP evita problemas de pool de conexiones en funciones serverless.
- **Server Actions** para todas las mutaciones (alta de producto, ajuste de stock) — coincide con el SPEC y evita mantener API routes en paralelo.
- **`@zxing/browser` encapsulado en un único hook/componente** (`src/lib/scanner.ts` + componente cliente) para que el resto de la app no dependa directamente de la librería — si el día de mañana se cambia por `BarcodeDetector` nativo, se toca un solo archivo.
- **Índices en `products.barcode` y `products.name`** desde la migración inicial, dado el criterio de éxito de 5000 productos sin degradación de búsqueda.

## Task List

### Phase 1: Foundation

- [ ] Task 1: Scaffold del proyecto Next.js
- [ ] Task 2: Esquema de base de datos y conexión a Neon

### Checkpoint: Foundation
- [ ] `npm run build` pasa sin errores
- [ ] `npm run db:migrate` corre contra la DB de desarrollo sin errores
- [ ] Revisión con el usuario antes de seguir

### Phase 2: Autenticación

- [ ] Task 3: Registro y login con Auth.js

### Checkpoint: Auth
- [ ] Un usuario nuevo puede registrarse, cerrar sesión y volver a loguearse

### Phase 3: Flujo de inventario (escaneo → producto → stock)

- [ ] Task 4: Componente de escaneo por cámara
- [ ] Task 5: Búsqueda de producto por código escaneado
- [ ] Task 6: Alta de producto nuevo
- [ ] Task 7: Ajuste de stock (sumar/restar + registro de movimiento)

### Checkpoint: Flujo core
- [ ] Flujo completo funciona a mano: loguearse → escanear → (producto existe: ver stock, ajustar) o (no existe: dar de alta) → el movimiento queda registrado
- [ ] Revisión con el usuario antes de seguir

### Phase 4: Búsqueda y pulido

- [ ] Task 8: Búsqueda de productos por nombre/código sin escanear
- [ ] Task 9: Manejo de permisos de cámara y verificación mobile
- [ ] Task 10: Tests e2e de los flujos críticos

### Checkpoint: Completo
- [ ] Todos los criterios de éxito del SPEC.md están cumplidos
- [ ] `npm run lint`, `npm test` y `npm run test:e2e` pasan
- [ ] Listo para review final

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Safari iOS tiene comportamiento distinto para permisos de cámara | Medio | Probar Task 4 temprano en iOS Safari real, no solo desktop Chrome |
| Driver de conexión mal elegido para Neon serverless (timeouts/pool exhaustion) | Alto | Usar `neon-http` desde el Task 2, no el driver `pg` estándar |
| Catálogo de 5000 productos hace lenta la búsqueda | Medio | Índices en `barcode` y `name` desde la migración inicial (Task 2), paginar el listado (Task 8) |
| Falsos negativos/positivos al escanear (mala luz, códigos dañados) | Bajo | Permitir ingreso manual del código como fallback en el mismo componente (Task 4) |

## Open Questions

Heredadas del SPEC.md (no bloquean el plan, pero quedan pendientes de decidir más adelante): generación/impresión de códigos propios, reportes/exportación de movimientos, roles de usuario, soporte offline.
